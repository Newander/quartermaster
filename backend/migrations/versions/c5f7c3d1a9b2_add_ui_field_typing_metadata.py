"""Add ui field typing metadata

Revision ID: c5f7c3d1a9b2
Revises: 89bc42efc5ba
Create Date: 2026-04-20 22:30:00.000000

"""

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c5f7c3d1a9b2"
down_revision: Union[str, None] = "89bc42efc5ba"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _normalize_value_type(raw_type: str | None) -> str:
    normalized = (raw_type or "").strip().lower()

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


def _has_allowed_values(raw_allowed_values: str | None) -> bool:
    if not raw_allowed_values:
        return False

    try:
        parsed = json.loads(raw_allowed_values)
    except json.JSONDecodeError:
        return bool(raw_allowed_values.strip())

    return bool(parsed)


def _infer_ui_type(
    column_name: str,
    *,
    value_type: str,
    has_allowed_values: bool,
    input_mode: str,
) -> str:
    column_lower = column_name.lower()

    if has_allowed_values or input_mode == "lookup":
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


def _infer_input_mode(column_name: str) -> str:
    column_lower = column_name.lower()
    if column_lower.endswith("_id") and column_lower != "id":
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
    semantic: str | None,
) -> dict[str, str | int | float | bool] | None:
    rules: dict[str, str | int | float | bool] = {}
    column_lower = column_name.lower()

    if semantic == "email" or "email" in column_lower:
        rules["format"] = "email"
        rules["max_length"] = 320

    if semantic == "phone" or "phone" in column_lower or "tel" in column_lower:
        rules["pattern"] = r"^\+?[0-9\-() ]{7,20}$"

    if semantic and semantic.startswith("month") and value_type == "int":
        rules["min"] = 1
        rules["max"] = 12

    return rules or None


def _infer_derive(column_name: str, value_type: str) -> dict[str, str] | None:
    column_lower = column_name.lower()
    if value_type != "int" or not column_lower.endswith("_month"):
        return None

    source_prefix = column_lower[:-6]
    if not source_prefix:
        return None

    return {
        "from": f"{source_prefix}_date",
        "op": "month",
    }


def upgrade() -> None:
    with op.batch_alter_table("field_description", schema=None) as batch_op:
        batch_op.add_column(sa.Column("value_type", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("ui_type", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("input_mode", sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column("semantic", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("rules_json", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("derive_json", sa.Text(), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT id, column_name, data_type, allowed_values
            FROM field_description
            """
        )
    ).mappings()

    for row in rows:
        value_type = _normalize_value_type(row["data_type"])
        input_mode = _infer_input_mode(row["column_name"])
        ui_type = _infer_ui_type(
            row["column_name"],
            value_type=value_type,
            has_allowed_values=_has_allowed_values(row["allowed_values"]),
            input_mode=input_mode,
        )
        semantic = _infer_semantic(row["column_name"], value_type)
        rules = _infer_rules(
            row["column_name"],
            value_type=value_type,
            semantic=semantic,
        )
        derive = _infer_derive(row["column_name"], value_type)
        if derive:
            input_mode = "derived"

        bind.execute(
            sa.text(
                """
                UPDATE field_description
                SET value_type = :value_type,
                    ui_type = :ui_type,
                    input_mode = :input_mode,
                    semantic = :semantic,
                    rules_json = :rules_json,
                    derive_json = :derive_json
                WHERE id = :id
                """
            ),
            {
                "id": row["id"],
                "value_type": value_type,
                "ui_type": ui_type,
                "input_mode": input_mode,
                "semantic": semantic,
                "rules_json": json.dumps(rules, ensure_ascii=False) if rules else None,
                "derive_json": json.dumps(derive, ensure_ascii=False) if derive else None,
            },
        )


def downgrade() -> None:
    with op.batch_alter_table("field_description", schema=None) as batch_op:
        batch_op.drop_column("derive_json")
        batch_op.drop_column("rules_json")
        batch_op.drop_column("semantic")
        batch_op.drop_column("input_mode")
        batch_op.drop_column("ui_type")
        batch_op.drop_column("value_type")
