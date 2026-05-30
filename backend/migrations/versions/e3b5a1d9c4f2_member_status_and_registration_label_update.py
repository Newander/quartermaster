"""Add member status and update member registration_date label

Revision ID: e3b5a1d9c4f2
Revises: c5f7c3d1a9b2
Create Date: 2026-04-21 15:35:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "e3b5a1d9c4f2"
down_revision: Union[str, None] = "c5f7c3d1a9b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MEMBER_STATUS_ALLOWED_VALUES = '["active","not_active"]'


def _upsert_member_status_field_description(bind) -> None:
    existing_id = bind.execute(
        sa.text(
            """
            SELECT id
            FROM field_description
            WHERE table_name = :table_name AND column_name = :column_name
            """
        ),
        {"table_name": "member", "column_name": "status"},
    ).scalar()

    payload = {
        "table_name": "member",
        "column_name": "status",
        "transcription": "Status",
        "data_type": "MemberStatus",
        "value_type": "string",
        "ui_type": "select",
        "input_mode": "manual",
        "semantic": None,
        "rules_json": None,
        "derive_json": None,
        "allowed_values": MEMBER_STATUS_ALLOWED_VALUES,
        "description": "Status członka klubu: active / not_active",
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
    bind = op.get_bind()
    member_status_enum = sa.Enum("ACTIVE", "NOT_ACTIVE", name="memberstatus")
    member_status_enum.create(bind, checkfirst=True)

    with op.batch_alter_table("member", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "status",
                member_status_enum,
                nullable=False,
                server_default=sa.text("'ACTIVE'"),
            )
        )

    bind.execute(
        sa.text(
            """
            UPDATE field_description
            SET transcription = :label,
                description = :label
            WHERE table_name = 'member' AND column_name = 'registration_date'
            """
        ),
        {"label": "Data rozpoczęcia treningu"},
    )

    _upsert_member_status_field_description(bind)


def downgrade() -> None:
    bind = op.get_bind()

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
            "description": "Pierwszy dzień, w którym osoba zapisała się do klubu",
        },
    )

    bind.execute(
        sa.text(
            """
            DELETE FROM field_description
            WHERE table_name = :table_name AND column_name = :column_name
            """
        ),
        {"table_name": "member", "column_name": "status"},
    )

    with op.batch_alter_table("member", schema=None) as batch_op:
        batch_op.drop_column("status")

    member_status_enum = sa.Enum("ACTIVE", "NOT_ACTIVE", name="memberstatus")
    member_status_enum.drop(bind, checkfirst=True)
