import csv
import io
import json
import logging
from typing import Annotated, Literal, Callable, Any

from app.common.ui_schema import build_model_ui_schema
from app.auth.dependancies import get_current_user
from app.database import QuartermasterCRMBase, dep_get_session, QuartermasterModelBuilder
from app.db_schemas import (
    ColumnMetaUpsertIn,
    ModelMetaOut,
    ModelMetaUpsertIn,
    RelationLookupOut,
)
from app.models import User, FieldDescription
from app.utils import model_to_dict_selective
from fastapi import APIRouter, HTTPException, Path
from fastapi.params import Depends, Query as QueryParam
from pydantic import BaseModel, ValidationError, create_model
from sqlalchemy import String, cast, func, inspect as sa_inspect, or_
from sqlalchemy.orm import Session, Query, InstrumentedAttribute
from starlette import status
from starlette.responses import StreamingResponse

type RoutesType = Literal['get', 'post', 'put', 'delete']
type FilterFunType[T] = tuple[str, str, type[object], Callable[[Query[T], Any], Query[T]]]
type RelationLookupsType = dict[str, RelationLookupOut]


def custom_filter[T: QuartermasterCRMBase](
    query: Query[T], column: InstrumentedAttribute, value: Any,
) -> Query[T]:
    return query.filter(column == value)


class ListResponse[T: BaseModel](BaseModel):
    total: int
    records: list[T]


class RouteAlchemyManager:
    """ Creating default REST CRUD API routes """

    def __init__(
        self,
        db_model: type[QuartermasterCRMBase],
        api_prefix: str = "",
        is_controlling_paths: bool = False,
        get_depends: list[Depends] | None = None,
        create_depends: list[Depends] | None = None,
        edit_depends: list[Depends] | None = None,
        delete_depends: list[Depends] | None = None,
        relation_lookups: RelationLookupsType | None = None,
    ):
        self.model_name = db_model.__name__.replace("Model", "").replace("model", "")
        self.router = APIRouter(prefix=api_prefix)
        self.db_model = db_model
        self.path_id_name = f'{db_model.table()}_id'
        # Depends
        self.delete_depends = delete_depends or []
        self.create_depends = create_depends or []
        self.edit_depends = edit_depends or []
        self.get_depends = get_depends or []
        # Type Models
        self.builder = QuartermasterModelBuilder(self.db_model, max_depth=1)
        self.full_pyd_cls = self.builder.full_pyd_model(user_roles=set())
        # Control
        self.is_controlling_paths = is_controlling_paths
        self.created_paths: list[tuple[RoutesType, str]] = []
        self.filters = []
        self.relation_lookups: RelationLookupsType = relation_lookups or {}

        for lookup_name, lookup in self.relation_lookups.items():
            if not lookup.foreign_key:
                lookup.foreign_key = lookup_name

    def _resolve_lookup_foreign_table(
        self,
        lookup_name: str,
        lookup: RelationLookupOut,
    ) -> str | None:
        mapper = sa_inspect(self.db_model)
        lookup_key = lookup.foreign_key or lookup_name

        if lookup_key in mapper.columns:
            column = mapper.columns[lookup_key]
            for foreign_key in column.foreign_keys:
                return foreign_key.column.table.name

        relation_key = lookup_name if lookup_name in mapper.relationships else lookup_key
        if relation_key in mapper.relationships:
            relationship = mapper.relationships[relation_key]
            target_table = relationship.mapper.local_table
            return target_table.name if target_table is not None else None

        return None

    @staticmethod
    def _resolve_lookup_field_description(
        session: Session,
        cache: dict[tuple[str, str], FieldDescription | None],
        table_name: str,
        column_name: str,
    ) -> FieldDescription | None:
        cache_key = (table_name, column_name)
        if cache_key not in cache:
            cache[cache_key] = (
                session.query(FieldDescription)
                .filter_by(table_name=table_name, column_name=column_name)
                .first()
            )

        return cache[cache_key]

    def _build_relation_lookups_schema(self, session: Session) -> RelationLookupsType:
        field_descriptions = {
            field_description.column_name: field_description
            for field_description in session.query(FieldDescription)
            .filter_by(table_name=self.db_model.table())
            .all()
        }
        foreign_field_description_cache: dict[tuple[str, str], FieldDescription | None] = {}

        lookups_schema: RelationLookupsType = {}
        for lookup_name, lookup in self.relation_lookups.items():
            lookup_key = lookup.foreign_key or lookup_name
            lookup_field_description = (
                field_descriptions.get(lookup_name)
                or field_descriptions.get(lookup_key)
            )

            lookup_schema = lookup.model_copy(deep=True)
            if lookup_schema.foreign_table is None:
                lookup_schema.foreign_table = self._resolve_lookup_foreign_table(
                    lookup_name,
                    lookup_schema,
                )

            related_field_description: FieldDescription | None = None
            if lookup_schema.foreign_table:
                for column_name in (lookup_schema.label_field, lookup_schema.value_field):
                    related_field_description = self._resolve_lookup_field_description(
                        session,
                        foreign_field_description_cache,
                        lookup_schema.foreign_table,
                        column_name,
                    )
                    if related_field_description is not None:
                        break

            resolved_field_description = (
                lookup_field_description
                or related_field_description
            )

            if (
                lookup_schema.transcription is None
                and resolved_field_description is not None
            ):
                lookup_schema.transcription = resolved_field_description.transcription

            if (
                lookup_schema.description is None
                and resolved_field_description is not None
            ):
                lookup_schema.description = resolved_field_description.description

            lookups_schema[lookup_name] = lookup_schema

        return lookups_schema

    @staticmethod
    def _serialize_json_field(value: object | None) -> str | None:
        if value is None:
            return None
        return json.dumps(value, ensure_ascii=False)

    @staticmethod
    def _fallback_data_type(column: Any) -> str:
        try:
            return column.type.python_type.__name__
        except Exception:
            return str(column.type)

    @staticmethod
    def _fallback_transcription(column_name: str) -> str:
        return column_name.replace('_', ' ').capitalize()

    @staticmethod
    def _fallback_description(column_name: str) -> str:
        return f"Autogenerated field metadata for {column_name}"

    def _upsert_schema_metadata(
        self,
        session: Session,
        fields: list[ColumnMetaUpsertIn],
    ) -> None:
        mapper = sa_inspect(self.db_model)
        table_name = self.db_model.table()
        allowed_columns = {
            column.key: column
            for column in mapper.columns
            if column.key not in self.db_model._generated_excluded_fields
        }

        unknown_fields = sorted({field.name for field in fields if field.name not in allowed_columns})
        if unknown_fields:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown schema fields for {table_name}: {', '.join(unknown_fields)}",
            )

        existing_records = {
            record.column_name: record
            for record in session.query(FieldDescription)
            .filter_by(table_name=table_name)
            .all()
        }

        for field in fields:
            column_name = field.name
            column = allowed_columns[column_name]
            record = existing_records.get(column_name)

            if record is None:
                record = FieldDescription(
                    table_name=table_name,
                    column_name=column_name,
                    transcription=field.transcription or self._fallback_transcription(column_name),
                    data_type=field.data_type or self._fallback_data_type(column),
                    allowed_values=self._serialize_json_field(field.allowed_values),
                    description=field.description or self._fallback_description(column_name),
                    value_type=field.value_type,
                    ui_type=field.ui_type,
                    input_mode=field.input_mode,
                    semantic=field.semantic,
                    rules_json=self._serialize_json_field(field.rules),
                    derive_json=self._serialize_json_field(field.derive),
                    display_json=self._serialize_json_field(field.display),
                )
                session.add(record)
                existing_records[column_name] = record
                continue

            if "transcription" in field.model_fields_set:
                record.transcription = field.transcription or self._fallback_transcription(column_name)
            if "description" in field.model_fields_set:
                record.description = field.description or self._fallback_description(column_name)
            if "data_type" in field.model_fields_set:
                record.data_type = field.data_type or self._fallback_data_type(column)
            if "allowed_values" in field.model_fields_set:
                record.allowed_values = self._serialize_json_field(field.allowed_values)
            if "value_type" in field.model_fields_set:
                record.value_type = field.value_type
            if "ui_type" in field.model_fields_set:
                record.ui_type = field.ui_type
            if "input_mode" in field.model_fields_set:
                record.input_mode = field.input_mode
            if "semantic" in field.model_fields_set:
                record.semantic = field.semantic
            if "rules" in field.model_fields_set:
                record.rules_json = self._serialize_json_field(field.rules)
            if "derive" in field.model_fields_set:
                record.derive_json = self._serialize_json_field(field.derive)
            if "display" in field.model_fields_set:
                record.display_json = self._serialize_json_field(field.display)

        session.flush()

    def safe_route_append[T](
        self,
        method: RoutesType,
        path_prefix: str,
        route_callback: Callable,
        response_model: type[T],
        dependencies: list[Depends],
        description_line: str,
    ) -> None:
        if self.is_controlling_paths and (method, path_prefix) in self.created_paths:
            raise ValueError(f"Path {path_prefix} already exists for the {self.model_name}")

        getattr(
            self.router, method
        )(
            path_prefix,
            response_model=response_model,
            dependencies=dependencies,
            summary=description_line,
            description=description_line,
        )(
            route_callback
        )
        self.created_paths.append((method, path_prefix))

    def prepare_filtered_stmt[T](
        self,
        session: Session,
        filters: BaseModel | None,
        map_filters: dict[str, Callable[[Query[T], bool], Query[T]]],
        search: str | None,
        order_by_col: str | None,
        order_by_asc: Literal['asc', 'desc'],
        skip: int | None,
        limit: int | None,
    ) -> tuple[Query[QuartermasterCRMBase] | Query[Any], Query[QuartermasterCRMBase] | Query[Any]]:
        """Builds full and paginated filtered database queries"""
        stmt_full = self.db_model.prepare_query(session)

        for f_name, f_value in ((filters and filters.model_dump()) or {}).items():
            if f_value is not None:
                stmt_full = map_filters[f_name](stmt_full, f_value)

        if normalized_search := (search or "").strip():
            search_pattern = f"%{normalized_search}%"
            lower_search_pattern = f"%{normalized_search.lower()}%"
            searchable_columns = [
                column
                for column in sa_inspect(self.db_model).columns
                if column.key not in self.db_model._generated_excluded_fields
            ]
            search_clauses = []

            for column in searchable_columns:
                cast_column = cast(getattr(self.db_model, column.key), String)
                search_clauses.append(cast_column.like(search_pattern))
                search_clauses.append(func.lower(cast_column).like(lower_search_pattern))

            if search_clauses:
                stmt_full = stmt_full.filter(or_(*search_clauses))

        # todo: fix possible absence of id
        stmt_limited = stmt_full.order_by(
            getattr(
                self.db_model.id if order_by_col is None else getattr(self.db_model, order_by_col),
                order_by_asc
            )()
        )
        if skip is not None:
            stmt_limited = stmt_limited.offset(skip)
        if limit is not None:
            stmt_limited = stmt_limited.limit(limit)

        return stmt_full, stmt_limited

    @staticmethod
    def parse_filters_payload[TFilter: BaseModel](
        filter_model: type[TFilter],
        filters_raw: str | None,
    ) -> TFilter | None:
        if not filters_raw:
            return None

        try:
            return filter_model.model_validate_json(filters_raw)
        except ValidationError as error:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=error.errors(),
            ) from error

    def link_get_route(self) -> None:
        path_id_name = self.path_id_name
        full_pyd_cls = self.full_pyd_cls

        ### Wrapped function START ###
        def wrapped_get_route(
            int_id: Annotated[int, Path(alias=path_id_name)],
            session: Annotated[Session, Depends(dep_get_session)],
            user: Annotated[User, Depends(get_current_user), None] = None,
        ) -> full_pyd_cls:
            if db_rec := self.db_model.get(session, int_id):
                return self.builder.full_pyd_model(user.role_names()).model_validate(db_rec)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{self.model_name}#{int_id} not found"
            )

        ### Wrapped function END ###
        self.safe_route_append(
            'get',
            "/{" + path_id_name + ":int}",
            wrapped_get_route,
            full_pyd_cls,
            self.get_depends,
            f"Get a specific {self.model_name} by ID"
        )

    def link_list_route[T: QuartermasterCRMBase](
        self,
        list_filters: list[FilterFunType[T]] | None = None,
    ) -> None:
        full_pyd_cls = self.full_pyd_cls

        self.filters.extend(list_filters or [])

        map_filters = {f_name: f_function for f_name, *_, f_function in self.filters}
        filter_model: type[BaseModel] = create_model(
            f"{self.db_model.__name__}Filter",
            **{f_name: (f_type | None, None) for f_name, _, f_type, _ in self.filters},
        )

        ### Wrapped function START ###
        def wrapped_list_route(
            session: Annotated[Session, Depends(dep_get_session)],
            user: Annotated[User, Depends(get_current_user), None] = None,
            # Pagination
            skip: int = QueryParam(0, ge=0),
            limit: int = QueryParam(100, ge=1),
            # Ordering
            order_by_col: str | None = QueryParam(None),
            order_by_asc: Literal['asc', 'desc'] = QueryParam('asc'),
            filters: str | None = QueryParam(None),
            search: str | None = QueryParam(None),
        ) -> ListResponse[list[full_pyd_cls]]:
            parsed_filters = self.parse_filters_payload(filter_model, filters)
            pyd_cls = self.builder.full_pyd_model(user_roles=user.role_names())
            stmt_full, stmt_limited = self.prepare_filtered_stmt(
                session,
                parsed_filters,
                map_filters,
                search,
                order_by_col,
                order_by_asc,
                skip,
                limit,
            )
            total = stmt_full.count()
            records = stmt_limited.all()
            return ListResponse(total=total, records=[pyd_cls.model_validate(r) for r in records])

        ### Wrapped function END ###
        self.safe_route_append(
            'get',
            "",
            wrapped_list_route,
            response_model=ListResponse[full_pyd_cls],
            dependencies=self.get_depends,
            description_line=f"List {self.model_name} with pagination and filters"
        )

    def link_create_route(self, unique_field: str | None = None) -> None:
        create_pyd_cls = self.builder.create_pyd_model()
        full_pyd_cls = self.full_pyd_cls

        ### Wrapped function START ###
        def wrapped_post_route(
            session: Annotated[Session, Depends(dep_get_session)],
            new_pyd_model: create_pyd_cls,
        ) -> full_pyd_cls:
            if (unique_field and
                session.query(self.db_model).filter_by(
                    **{unique_field: getattr(new_pyd_model, unique_field)}).first()):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{unique_field} already registered"
                )

            db_record = self.db_model(**new_pyd_model.model_dump())
            session.add(db_record)
            session.commit()
            session.refresh(db_record)
            return db_record

        ### Wrapped function END ###
        self.safe_route_append(
            'post',
            "",
            route_callback=wrapped_post_route,
            response_model=full_pyd_cls,
            dependencies=self.create_depends,
            description_line=f"Create new {self.model_name}"
        )

    def link_update_route(
        self, unique_field: str | None = None,
    ):
        path_id_name = self.path_id_name
        update_pyd_cls = self.builder.update_pyd_model()
        full_pyd_cls = self.full_pyd_cls

        ### Wrapped function START ###
        def wrapped_put_route(
            int_id: Annotated[int, Path(alias=path_id_name)],
            session: Annotated[Session, Depends(dep_get_session)],
            updated_pyd_model: update_pyd_cls,
        ) -> full_pyd_cls:
            if not (db_record := session.query(self.db_model).filter_by(id=int_id).first()):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No record found with id:{int_id}"
                )
            if not (update_data := updated_pyd_model.model_dump(exclude_unset=True)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Empty model was sent"
                )

            if unique_field is not None:
                # Check if field is being updated and if it's already taken
                if ((unique_field_value := getattr(updated_pyd_model, unique_field))
                    and getattr(db_record, unique_field) != unique_field_value
                    and session.query(self.db_model).filter_by(**{unique_field: unique_field_value}).first()):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"{unique_field} already registered"
                    )

            for field, value in update_data.items():
                setattr(db_record, field, value)

            session.commit()
            session.refresh(db_record)
            return db_record

        ### Wrapped function END ###
        self.safe_route_append(
            'put',
            "/{" + path_id_name + ":int}",
            route_callback=wrapped_put_route,
            response_model=full_pyd_cls,
            dependencies=self.edit_depends,
            description_line=f"Update existed {self.model_name}"
        )

    def link_export_route[T: QuartermasterCRMBase](
        self,
        list_filters: list[tuple[str, type[object], Callable[[Query[T], bool], Query[T]]]] | None = None,
    ) -> None:
        list_filters = list_filters or []
        map_filters = {f_name: f_function for f_name, _, f_function in list_filters}
        filter_model: type[BaseModel] = create_model(
            f"{self.db_model.__name__}Filter",
            **{f_name: (f_type | None, None) for f_name, f_type, _ in list_filters},
        )

        ### Wrapped function START ###
        def wrapped_export_route(
            session: Annotated[Session, Depends(dep_get_session)],
            # Ordering
            order_by_col: str | None = QueryParam(None),
            order_by_asc: Literal['asc', 'desc'] = QueryParam('asc'),
            filters: str | None = QueryParam(None),
        ) -> StreamingResponse:
            parsed_filters = self.parse_filters_payload(filter_model, filters)
            stmt_full, _ = self.prepare_filtered_stmt(
                session,
                parsed_filters,
                map_filters,
                None,
                order_by_col,
                order_by_asc,
                skip=None,
                limit=None,
            )
            # todo@sgavrilov: not configured
            records = stmt_full.all()
            include_relations = []
            if True:
                include_relations.append('member_contracts')
            if True:
                include_relations.append('instructor_impersonation')
            if True:
                include_relations.append('shelf_rentals')

            members_data = []
            for db_record in records:
                updated_data = {}
                for k, v in (
                    record := model_to_dict_selective(db_record,
                                                      include_relations=include_relations or None)).items():
                    if v is not None and k in include_relations:
                        updated_data = {f'{k}_{kin}': vin for kin, vin in v.items()}

                for k in include_relations:
                    record.pop(k, None)

                record.update(updated_data)
                members_data.append(record)
            # Create CSV in memory
            output = io.StringIO()

            # Get column headers from first item
            fieldnames = members_data[0].keys()
            writer = csv.DictWriter(output, fieldnames=fieldnames)

            # Write header and rows
            writer.writeheader()
            writer.writerows(members_data)

            # Move to the beginning of the StringIO buffer
            output.seek(0)

            # Return as streaming response
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={
                    "Content-Disposition": "attachment; filename=export.csv"
                }
            )

        ### Wrapped function END ###
        self.safe_route_append(
            'post',
            "/export",
            wrapped_export_route,
            response_model=None,
            dependencies=self.get_depends,
            description_line=f"Export data from {self.model_name}"
        )

    def link_delete_route(self, to_archive: bool = True) -> None:
        path_id_name = self.path_id_name

        ### Wrapped function START ###
        def wrapped_delete_route(
            int_id: Annotated[int, Path(alias=path_id_name)],
            session: Annotated[Session, Depends(dep_get_session)],
        ) -> dict:
            if db_rec := self.db_model.get(session, int_id):
                if to_archive and hasattr(db_rec, 'is_deleted'):
                    db_rec.is_deleted = True
                    session.commit()
                else:
                    session.delete(db_rec)
                    session.commit()

                return {"status": "removed"}

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{self.model_name}#{int_id} not found"
            )

        ### Wrapped function END ###
        self.safe_route_append(
            'delete',
            "/{" + path_id_name + ":int}",
            wrapped_delete_route,
            dict,
            self.delete_depends,
            f"Get a specific {self.model_name} by ID"
        )

    def link_schema_route(self):
        """ Should be added after edit / update! """

        if ('get', '') not in self.created_paths and ('get', '/') not in self.created_paths:
            logging.warning(f"Schema route was created before list GET-model was added. So no filters will be applied.")

        ui_schema_filters = [(column, name, data_type.__name__) for column, name, data_type, _ in self.filters]

        ### Wrapped function START ###
        def wrapped_get_route(session: Annotated[Session, Depends(dep_get_session)]) -> ModelMetaOut:
            ui_schema = build_model_ui_schema(self.db_model, session)
            ui_schema.filters = ui_schema_filters
            ui_schema.relation_lookups = self._build_relation_lookups_schema(session)
            return ui_schema

        def wrapped_put_route(
            session: Annotated[Session, Depends(dep_get_session)],
            schema_payload: ModelMetaUpsertIn,
        ) -> ModelMetaOut:
            self._upsert_schema_metadata(session, schema_payload.fields)
            ui_schema = build_model_ui_schema(self.db_model, session)
            ui_schema.filters = ui_schema_filters
            ui_schema.relation_lookups = self._build_relation_lookups_schema(session)
            return ui_schema

        ### Wrapped function END ###
        self.safe_route_append(
            'get',
            "/schema",
            wrapped_get_route,
            ModelMetaOut,
            self.get_depends,
            f"Return all available fields for {self.model_name}"
        )
        self.safe_route_append(
            'put',
            "/schema",
            wrapped_put_route,
            ModelMetaOut,
            self.edit_depends,
            f"Upsert field metadata for {self.model_name}"
        )
