"""Add member.training_start_date as month-enabled date field

Revision ID: a4d9f2b7c1e8
Revises: e3b5a1d9c4f2
Create Date: 2026-04-21 18:05:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a4d9f2b7c1e8"
down_revision: Union[str, None] = "e3b5a1d9c4f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _upsert_training_start_field_description(bind) -> None:
    existing_id = bind.execute(
        sa.text(
            """
            SELECT id
            FROM field_description
            WHERE table_name = :table_name AND column_name = :column_name
            """
        ),
        {"table_name": "member", "column_name": "training_start_date"},
    ).scalar()

    payload = {
        "table_name": "member",
        "column_name": "training_start_date",
        "transcription": "Data rozpoczęcia treningu",
        "data_type": "date",
        "value_type": "date",
        "ui_type": "month",
        "input_mode": "manual",
        "semantic": None,
        "rules_json": None,
        "derive_json": None,
        "allowed_values": None,
        "description": "Miesiąc i rok rozpoczęcia treningu (zapisywane jako data).",
    }

    if existing_id is None:
        bind.execute(
            sa.text(
                """
                INSERT INTO field_description (
                    table_name,
                    column_name,
                    transcription,
                    data_type,
                    value_type,
                    ui_type,
                    input_mode,
                    semantic,
                    rules_json,
                    derive_json,
                    allowed_values,
                    description
                ) VALUES (
                    :table_name,
                    :column_name,
                    :transcription,
                    :data_type,
                    :value_type,
                    :ui_type,
                    :input_mode,
                    :semantic,
                    :rules_json,
                    :derive_json,
                    :allowed_values,
                    :description
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
                data_type = :data_type,
                value_type = :value_type,
                ui_type = :ui_type,
                input_mode = :input_mode,
                semantic = :semantic,
                rules_json = :rules_json,
                derive_json = :derive_json,
                allowed_values = :allowed_values,
                description = :description
            WHERE id = :id
            """
        ),
        payload | {"id": existing_id},
    )


def upgrade() -> None:
    with op.batch_alter_table("member", schema=None) as batch_op:
        batch_op.add_column(sa.Column("training_start_date", sa.Date(), nullable=True))

    bind = op.get_bind()
    _upsert_training_start_field_description(bind)

    bind.execute(
        sa.text(
            """
            UPDATE field_description
            SET transcription = :transcription,
                description = :description
            WHERE table_name = 'member' AND column_name = 'registration_date'
            """
        ),
        {
            "transcription": "Data rejestracji",
            "description": "Data rejestracji",
        },
    )


def downgrade() -> None:
    bind = op.get_bind()

    bind.execute(
        sa.text(
            """
            DELETE FROM field_description
            WHERE table_name = :table_name AND column_name = :column_name
            """
        ),
        {"table_name": "member", "column_name": "training_start_date"},
    )

    bind.execute(
        sa.text(
            """
            UPDATE field_description
            SET transcription = :transcription,
                description = :description
            WHERE table_name = 'member' AND column_name = 'registration_date'
            """
        ),
        {
            "transcription": "Data rozpoczęcia treningu",
            "description": "Data rozpoczęcia treningu",
        },
    )

    with op.batch_alter_table("member", schema=None) as batch_op:
        batch_op.drop_column("training_start_date")
