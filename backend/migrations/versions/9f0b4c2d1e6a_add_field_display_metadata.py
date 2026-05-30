"""Add field display metadata

Revision ID: 9f0b4c2d1e6a
Revises: d3a7b9c2e6f1
Create Date: 2026-05-27 12:00:00.000000
"""

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9f0b4c2d1e6a"
down_revision: Union[str, None] = "d3a7b9c2e6f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SHELF_PLAN_DESCRIPTION_DISPLAY = {
    "table": {
        "max_width": "18rem",
        "truncate": True,
        "tooltip": True,
    },
}


def _column_exists(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _column_exists(inspector, "field_description", "display_json"):
        with op.batch_alter_table("field_description", schema=None) as batch_op:
            batch_op.add_column(sa.Column("display_json", sa.Text(), nullable=True))

    bind.execute(
        sa.text(
            """
            UPDATE field_description
            SET display_json = :display_json
            WHERE table_name = :table_name AND column_name = :column_name
            """
        ),
        {
            "table_name": "shelf_plan",
            "column_name": "description",
            "display_json": json.dumps(SHELF_PLAN_DESCRIPTION_DISPLAY, ensure_ascii=False),
        },
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _column_exists(inspector, "field_description", "display_json"):
        with op.batch_alter_table("field_description", schema=None) as batch_op:
            batch_op.drop_column("display_json")
