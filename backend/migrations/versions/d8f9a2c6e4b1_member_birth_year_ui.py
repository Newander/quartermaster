"""Show member.date_of_birth as birth year in UI tables

Revision ID: d8f9a2c6e4b1
Revises: b7c2e1f4d9a3
Create Date: 2026-05-12 22:50:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d8f9a2c6e4b1"
down_revision: Union[str, None] = "b7c2e1f4d9a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _upsert_birth_date_field_description(bind, payload: dict[str, str | None]) -> None:
    existing_id = bind.execute(
        sa.text(
            """
            SELECT id
            FROM field_description
            WHERE table_name = :table_name AND column_name = :column_name
            """
        ),
        {"table_name": "member", "column_name": "date_of_birth"},
    ).scalar()

    if existing_id is None:
        bind.execute(
            sa.text(
                """
                INSERT INTO field_description (
                    table_name,
                    column_name,
                    transcription,
                    description,
                    data_type,
                    value_type,
                    ui_type,
                    input_mode
                ) VALUES (
                    :table_name,
                    :column_name,
                    :transcription,
                    :description,
                    :data_type,
                    :value_type,
                    :ui_type,
                    :input_mode
                )
                """
            ),
            payload,
        )
        return

    bind.execute(
        sa.text(
            """
            UPDATE field_description
            SET transcription = :transcription,
                description = :description,
                data_type = :data_type,
                value_type = :value_type,
                ui_type = :ui_type,
                input_mode = :input_mode
            WHERE id = :id
            """
        ),
        payload | {"id": existing_id},
    )


def upgrade() -> None:
    bind = op.get_bind()
    _upsert_birth_date_field_description(
        bind,
        {
            "table_name": "member",
            "column_name": "date_of_birth",
            "transcription": "Rok urodzenia",
            "description": "Rok urodzenia klubowicza (zapisywany jako pełna data).",
            "data_type": "date",
            "value_type": "date",
            "ui_type": "year",
            "input_mode": "manual",
        },
    )


def downgrade() -> None:
    bind = op.get_bind()
    _upsert_birth_date_field_description(
        bind,
        {
            "table_name": "member",
            "column_name": "date_of_birth",
            "transcription": "Data urodzenia",
            "description": "Data urodzenia klubowicza (używana m.in. do weryfikacji wieku)",
            "data_type": "date",
            "value_type": "date",
            "ui_type": "date",
            "input_mode": "manual",
        },
    )
