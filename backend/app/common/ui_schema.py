import json
import logging
from typing import Any

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.database import QuartermasterCRMBase
from app.db_schemas import ModelMetaOut

type JsonScalar = str | int | float | bool | None
type JsonValue = JsonScalar | list["JsonValue"] | dict[str, "JsonValue"]
type AllowedValue = str | int | float | bool


def _parse_json_value(raw_value: str | None, *, context: str) -> JsonValue | None:
    if not raw_value:
        return None

    try:
        return json.loads(raw_value)
    except json.JSONDecodeError:
        logging.warning("Failed to parse JSON value for %s", context)
        return None


def _fallback_legacy_data_type(column: Any) -> str:
    try:
        return column.type.python_type.__name__
    except Exception:
        return str(column.type)


def _normalize_allowed_values(
    raw_allowed_values: JsonValue | None,
    *,
    context: str,
) -> list[AllowedValue] | None:
    if raw_allowed_values is None:
        return None

    if not isinstance(raw_allowed_values, list):
        logging.warning(
            "Expected allowed_values list for %s, got %s",
            context,
            type(raw_allowed_values).__name__,
        )
        return None

    normalized_values: list[AllowedValue] = []
    for allowed_value in raw_allowed_values:
        if isinstance(allowed_value, (str, int, float, bool)):
            normalized_values.append(allowed_value)
        else:
            logging.warning(
                "Skipping non-scalar allowed_value for %s: %s",
                context,
                type(allowed_value).__name__,
            )

    return normalized_values


def _normalize_value_type(
    explicit_value_type: str | None,
    legacy_data_type: str | None,
) -> str:
    normalized = (explicit_value_type or legacy_data_type or "").strip().lower()

    if normalized in {"str", "string", "text", "char"} or normalized.startswith("varchar"):
        return "string"
    if normalized in {"int", "integer", "bigint", "smallint"}:
        return "int"
    if normalized in {"float", "double", "decimal", "numeric"}:
        return "decimal"
    if normalized in {"bool", "boolean"}:
        return "bool"
    if normalized == "date":
        return "date"
    if normalized in {"datetime", "timestamp"}:
        return "datetime"
    if normalized == "uuid":
        return "uuid"

    return "string"


def _infer_ui_type(
    column_name: str,
    *,
    value_type: str,
    has_allowed_values: bool,
    has_foreign_keys: bool,
) -> str:
    column_lower = column_name.lower()
    if has_allowed_values or has_foreign_keys:
        return "select"
    if "email" in column_lower:
        return "email"
    if "phone" in column_lower or "tel" in column_lower:
        return "tel"
    if "month" in column_lower:
        return "month"
    if value_type == "bool":
        return "checkbox"
    if value_type == "date":
        return "date"
    if value_type == "datetime":
        return "datetime"
    if any(marker in column_lower for marker in ("description", "notes", "bio")):
        return "textarea"
    return "text"


def _infer_input_mode(*, has_foreign_keys: bool, derive: dict[str, JsonValue] | None) -> str:
    if derive:
        return "derived"
    if has_foreign_keys:
        return "lookup"
    return "manual"


def _infer_semantic(column_name: str, value_type: str) -> str | None:
    column_lower = column_name.lower()

    if "email" in column_lower:
        return "email"
    if "phone" in column_lower or "tel" in column_lower:
        return "phone"
    if "month" in column_lower:
        return "month_number" if value_type == "int" else "month_name"
    if any(marker in column_lower for marker in ("amount", "price", "balance", "discount", "cost", "fee")):
        return "money"
    if "percent" in column_lower or "pct" in column_lower:
        return "percent"

    return None


def _infer_rules(
    column_name: str,
    *,
    value_type: str,
    nullable: bool,
    semantic: str | None,
) -> dict[str, JsonValue] | None:
    rules: dict[str, JsonValue] = {}
    column_lower = column_name.lower()

    if not nullable:
        rules["required"] = True

    if semantic == "email" or "email" in column_lower:
        rules["format"] = "email"
        rules["max_length"] = 320

    if semantic == "phone" or "phone" in column_lower or "tel" in column_lower:
        rules["pattern"] = r"^\+?[0-9\-() ]{7,20}$"

    if semantic and semantic.startswith("month") and value_type == "int":
        rules["min"] = 1
        rules["max"] = 12

    return rules or None


def build_model_ui_schema(
    model_cls: type[QuartermasterCRMBase],
    session: Session,
) -> ModelMetaOut:
    from app.models import FieldDescription

    mapper = inspect(model_cls)
    field_descriptions: dict[str, FieldDescription] = {
        record.column_name: record
        for record in session.query(FieldDescription)
        .filter_by(table_name=model_cls.table())
        .all()
    }

    def serialize_default(column) -> Any:
        if column.default is not None:
            if column.default.is_scalar:
                return column.default.arg
            if column.default.is_callable:
                callback = column.default.arg
                return f"<callable:{getattr(callback, '__name__', repr(callback))}>"
            return repr(column.default.arg)

        if column.server_default is not None:
            return str(column.server_default.arg)

        return None

    fields: list[dict[str, Any]] = []

    for column in mapper.columns:
        if column.key in model_cls._generated_excluded_fields:
            continue

        field_description = field_descriptions.get(column.key)
        if field_description is None:
            logging.warning(
                "FieldDescription row not found for %s.%s, using fallback schema metadata.",
                model_cls.table(),
                column.key,
            )

        foreign_keys = []
        for foreign_key in column.foreign_keys:
            remote_column = foreign_key.column
            foreign_keys.append(
                {
                    "target_table": remote_column.table.name,
                    "target_field": remote_column.name,
                    "target_fullname": foreign_key.target_fullname,
                }
            )

        allowed_values_context = f"{model_cls.table()}.{column.key}.allowed_values"
        raw_allowed_values = _parse_json_value(
            field_description.allowed_values if field_description else None,
            context=allowed_values_context,
        )
        parsed_allowed_values = _normalize_allowed_values(
            raw_allowed_values,
            context=allowed_values_context,
        )

        parsed_rules = _parse_json_value(
            field_description.rules_json if field_description else None,
            context=f"{model_cls.table()}.{column.key}.rules_json",
        )
        if parsed_rules is not None and not isinstance(parsed_rules, dict):
            logging.warning(
                "Expected rules_json object for %s.%s, got %s",
                model_cls.table(),
                column.key,
                type(parsed_rules).__name__,
            )
            parsed_rules = None

        parsed_derive = _parse_json_value(
            field_description.derive_json if field_description else None,
            context=f"{model_cls.table()}.{column.key}.derive_json",
        )
        if parsed_derive is not None and not isinstance(parsed_derive, dict):
            logging.warning(
                "Expected derive_json object for %s.%s, got %s",
                model_cls.table(),
                column.key,
                type(parsed_derive).__name__,
            )
            parsed_derive = None

        parsed_display = _parse_json_value(
            field_description.display_json if field_description else None,
            context=f"{model_cls.table()}.{column.key}.display_json",
        )
        if parsed_display is not None and not isinstance(parsed_display, dict):
            logging.warning(
                "Expected display_json object for %s.%s, got %s",
                model_cls.table(),
                column.key,
                type(parsed_display).__name__,
            )
            parsed_display = None

        value_type = _normalize_value_type(
            field_description.value_type if field_description else None,
            field_description.data_type if field_description else _fallback_legacy_data_type(column),
        )
        legacy_type = (
            (field_description.data_type if field_description else _fallback_legacy_data_type(column))
            or ""
        ).strip() or value_type
        ui_type = (field_description.ui_type if field_description else None) or _infer_ui_type(
            column.key,
            value_type=value_type,
            has_allowed_values=bool(parsed_allowed_values),
            has_foreign_keys=bool(foreign_keys),
        )
        input_mode = (field_description.input_mode if field_description else None) or _infer_input_mode(
            has_foreign_keys=bool(foreign_keys),
            derive=parsed_derive,
        )
        semantic = (
            field_description.semantic if field_description else None
        ) or _infer_semantic(column.key, value_type)
        inferred_rules = _infer_rules(
            column.key,
            value_type=value_type,
            nullable=column.nullable,
            semantic=semantic,
        )
        merged_rules = {
            **(inferred_rules or {}),
            **(parsed_rules or {}),
        } or None

        fields.append(
            {
                "name": column.key,
                "transcription": (
                    field_description.transcription
                    if field_description
                    else column.key.replace("_", " ").capitalize()
                ),
                "description": (
                    field_description.description
                    if field_description
                    else f"Autogenerated field metadata for {column.key}"
                ),
                "data_type": legacy_type,
                "value_type": value_type,
                "ui_type": ui_type,
                "input_mode": input_mode,
                "semantic": semantic,
                "nullable": column.nullable,
                "primary_key": column.primary_key,
                "default": serialize_default(column),
                "foreign_keys": foreign_keys,
                "allowed_values": parsed_allowed_values,
                "rules": merged_rules,
                "derive": parsed_derive,
                "display": parsed_display,
            }
        )

    return ModelMetaOut.model_validate(
        {
            "name": model_cls.table(),
            "fields": fields,
            "filters": [],
        }
    )
