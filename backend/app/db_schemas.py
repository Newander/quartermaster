from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

type DefaultLiteral = str | int | float | bool | None
type JsonScalar = str | int | float | bool | None
type JsonValue = JsonScalar | list["JsonValue"] | dict[str, "JsonValue"]
type AllowedValue = str | int | float | bool


class ForeignKeyOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_table: str
    target_field: str
    target_fullname: str | None = None


class ColumnMetaOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    transcription: str
    description: str
    data_type: str
    value_type: str
    ui_type: str
    input_mode: str
    semantic: str | None = None
    nullable: bool
    primary_key: bool
    default: DefaultLiteral
    foreign_keys: list[ForeignKeyOut]
    allowed_values: list[AllowedValue] | None
    rules: dict[str, JsonValue] | None = None
    derive: dict[str, JsonValue] | None = None
    display: dict[str, JsonValue] | None = None


class ColumnMetaUpsertIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    transcription: str | None = None
    description: str | None = None
    data_type: str | None = None
    value_type: str | None = None
    ui_type: str | None = None
    input_mode: str | None = None
    semantic: str | None = None
    allowed_values: list[AllowedValue] | None = None
    rules: dict[str, JsonValue] | None = None
    derive: dict[str, JsonValue] | None = None
    display: dict[str, JsonValue] | None = None


class RelationLookupOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    api_route: str
    value_field: str = 'id'
    source_value_field: str | None = None
    label_field: str
    transcription: str | None = None
    description: str | None = None
    app_route: str | None = None
    relation_kind: Literal["one", "many"] = "one"
    foreign_key: str | None = None
    foreign_table: str | None = None


class ModelMetaOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    fields: list[ColumnMetaOut]
    filters: list[tuple[str, str, str]] = Field(default_factory=list)
    relation_lookups: dict[str, RelationLookupOut] = Field(default_factory=dict)


class ModelMetaUpsertIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    fields: list[ColumnMetaUpsertIn]
