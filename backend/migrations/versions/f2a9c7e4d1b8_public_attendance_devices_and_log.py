"""Add public attendance devices and audit log

Revision ID: f2a9c7e4d1b8
Revises: d8f9a2c6e4b1
Create Date: 2026-05-14 12:00:00.000000
"""

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f2a9c7e4d1b8"
down_revision: Union[str, None] = "d8f9a2c6e4b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ATTENDANCE_TABLE = "training_session_attendance_m2m"
ATTENDANCE_UNIQUE_CONSTRAINT = "uq_training_session_attendance_session_member"


def _table_exists(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_exists(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _index_exists(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def _foreign_key_exists(inspector: sa.Inspector, table_name: str, foreign_key_name: str) -> bool:
    return foreign_key_name in {
        foreign_key["name"]
        for foreign_key in inspector.get_foreign_keys(table_name)
    }


def _unique_constraint_exists(
    inspector: sa.Inspector,
    table_name: str,
    constraint_name: str,
    column_names: list[str],
) -> bool:
    requested_columns = set(column_names)
    for constraint in inspector.get_unique_constraints(table_name):
        if constraint["name"] == constraint_name:
            return True
        if set(constraint.get("column_names") or []) == requested_columns:
            return True
    return False


def _upsert_field_description(
    bind,
    *,
    table_name: str,
    column_name: str,
    transcription: str,
    description: str,
    data_type: str,
    value_type: str,
    ui_type: str,
    input_mode: str,
    allowed_values: object | None = None,
) -> None:
    payload = {
        "table_name": table_name,
        "column_name": column_name,
        "transcription": transcription,
        "description": description,
        "data_type": data_type,
        "allowed_values": json.dumps(allowed_values, ensure_ascii=False) if allowed_values else None,
        "value_type": value_type,
        "ui_type": ui_type,
        "input_mode": input_mode,
    }
    existing_id = bind.execute(
        sa.text(
            """
            SELECT id
            FROM field_description
            WHERE table_name = :table_name AND column_name = :column_name
            """
        ),
        {"table_name": table_name, "column_name": column_name},
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
                    allowed_values,
                    value_type,
                    ui_type,
                    input_mode
                ) VALUES (
                    :table_name,
                    :column_name,
                    :transcription,
                    :description,
                    :data_type,
                    :allowed_values,
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
                allowed_values = :allowed_values,
                value_type = :value_type,
                ui_type = :ui_type,
                input_mode = :input_mode
            WHERE id = :id
            """
        ),
        payload | {"id": existing_id},
    )


def _delete_field_descriptions(bind, table_names: list[str], attendance_columns: list[str]) -> None:
    bind.execute(
        sa.text(
            """
            DELETE FROM field_description
            WHERE table_name IN :table_names
               OR (table_name = :attendance_table AND column_name IN :attendance_columns)
            """
        ).bindparams(
            sa.bindparam("table_names", expanding=True),
            sa.bindparam("attendance_columns", expanding=True),
        ),
        {
            "table_names": table_names,
            "attendance_table": ATTENDANCE_TABLE,
            "attendance_columns": attendance_columns,
        },
    )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _table_exists(inspector, "public_device_identity"):
        op.create_table(
            "public_device_identity",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("token_hash", sa.String(length=64), nullable=False),
            sa.Column("assigned_member_id", sa.Integer(), nullable=True),
            sa.Column("last_seen_at", sa.DateTime(), nullable=True),
            sa.Column("assignment_changed_at", sa.DateTime(), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("1"), nullable=False),
            sa.Column("notes", sa.String(length=3000), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["assigned_member_id"], ["member.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("token_hash"),
        )
        inspector = sa.inspect(bind)

    if not _index_exists(inspector, "public_device_identity", "ix_public_device_identity_token_hash"):
        op.create_index("ix_public_device_identity_token_hash", "public_device_identity", ["token_hash"], unique=True)
    if not _index_exists(inspector, "public_device_identity", "ix_public_device_identity_assigned_member_id"):
        op.create_index(
            "ix_public_device_identity_assigned_member_id",
            "public_device_identity",
            ["assigned_member_id"],
            unique=False,
        )
    inspector = sa.inspect(bind)

    if not _table_exists(inspector, "attendance_change_log"):
        op.create_table(
            "attendance_change_log",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("attendance_id", sa.Integer(), nullable=True),
            sa.Column("session_id", sa.Integer(), nullable=False),
            sa.Column("member_id", sa.Integer(), nullable=False),
            sa.Column("device_identity_id", sa.Integer(), nullable=True),
            sa.Column("changed_by", sa.String(length=32), nullable=False),
            sa.Column("previous_attended", sa.Boolean(), nullable=True),
            sa.Column("new_attended", sa.Boolean(), nullable=True),
            sa.Column("previous_notes", sa.String(length=200), nullable=True),
            sa.Column("new_notes", sa.String(length=200), nullable=True),
            sa.Column("changed_at", sa.DateTime(), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["attendance_id"], [f"{ATTENDANCE_TABLE}.id"]),
            sa.ForeignKeyConstraint(["device_identity_id"], ["public_device_identity.id"]),
            sa.ForeignKeyConstraint(["member_id"], ["member.id"]),
            sa.ForeignKeyConstraint(["session_id"], ["training_session.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        inspector = sa.inspect(bind)

    for index_name, columns in [
        ("ix_attendance_change_log_attendance_id", ["attendance_id"]),
        ("ix_attendance_change_log_session_id", ["session_id"]),
        ("ix_attendance_change_log_member_id", ["member_id"]),
        ("ix_attendance_change_log_device_identity_id", ["device_identity_id"]),
        ("ix_attendance_change_log_changed_at", ["changed_at"]),
    ]:
        if not _index_exists(inspector, "attendance_change_log", index_name):
            op.create_index(index_name, "attendance_change_log", columns)

    inspector = sa.inspect(bind)
    missing_attendance_columns = [
        column
        for column in [
            sa.Column(
                "source",
                sa.String(length=32),
                server_default=sa.text("'instructor'"),
                nullable=False,
            ),
            sa.Column("device_identity_id", sa.Integer(), nullable=True),
            sa.Column("self_reported_at", sa.DateTime(), nullable=True),
            sa.Column("instructor_verified_at", sa.DateTime(), nullable=True),
        ]
        if not _column_exists(inspector, ATTENDANCE_TABLE, column.name)
    ]
    attendance_device_fk_missing = not _foreign_key_exists(
        inspector,
        ATTENDANCE_TABLE,
        "fk_training_session_attendance_device_identity",
    )
    if missing_attendance_columns or attendance_device_fk_missing:
        with op.batch_alter_table(ATTENDANCE_TABLE, schema=None) as batch_op:
            for column in missing_attendance_columns:
                batch_op.add_column(column)
            if attendance_device_fk_missing:
                batch_op.create_foreign_key(
                    "fk_training_session_attendance_device_identity",
                    "public_device_identity",
                    ["device_identity_id"],
                    ["id"],
                )

    bind.execute(sa.text(f"UPDATE {ATTENDANCE_TABLE} SET source = 'instructor' WHERE source IS NULL"))
    bind.execute(
        sa.text(
            f"""
            DELETE FROM {ATTENDANCE_TABLE}
            WHERE id NOT IN (
                SELECT keep_id
                FROM (
                    SELECT MAX(id) AS keep_id
                    FROM {ATTENDANCE_TABLE}
                    GROUP BY session_id, member_id
                ) AS attendance_dedup_keep
            )
            """
        )
    )

    inspector = sa.inspect(bind)
    if not _unique_constraint_exists(
        inspector,
        ATTENDANCE_TABLE,
        ATTENDANCE_UNIQUE_CONSTRAINT,
        ["session_id", "member_id"],
    ):
        with op.batch_alter_table(ATTENDANCE_TABLE, schema=None) as batch_op:
            batch_op.create_unique_constraint(
                ATTENDANCE_UNIQUE_CONSTRAINT,
                ["session_id", "member_id"],
            )

    for field in [
        ("token_hash", "Token hash", "Hashed public device token.", "str", "string", "text", "manual"),
        ("assigned_member_id", "Assigned member", "Member currently assigned to the public device.", "int", "int", "select", "lookup"),
        ("last_seen_at", "Last seen at", "Last successful public request from this device.", "datetime", "datetime", "datetime", "manual"),
        ("assignment_changed_at", "Assignment changed at", "When the assigned member was last changed.", "datetime", "datetime", "datetime", "manual"),
        ("is_active", "Active", "Whether the public device can still be used.", "bool", "bool", "checkbox", "manual"),
        ("notes", "Notes", "Internal support notes for this public device.", "str", "string", "textarea", "manual"),
    ]:
        _upsert_field_description(
            bind,
            table_name="public_device_identity",
            column_name=field[0],
            transcription=field[1],
            description=field[2],
            data_type=field[3],
            value_type=field[4],
            ui_type=field[5],
            input_mode=field[6],
        )

    for field in [
        ("attendance_id", "Attendance", "Attendance record changed by this log entry.", "int", "int", "select", "lookup"),
        ("session_id", "Session", "Training session affected by this change.", "int", "int", "select", "lookup"),
        ("member_id", "Member", "Member affected by this change.", "int", "int", "select", "lookup"),
        ("device_identity_id", "Public device", "Public device that made this change, if any.", "int", "int", "select", "lookup"),
        ("changed_by", "Changed by", "Source that made the attendance change.", "str", "string", "select", "manual"),
        ("previous_attended", "Previous attendance", "Attendance value before the change.", "bool", "bool", "checkbox", "manual"),
        ("new_attended", "New attendance", "Attendance value after the change.", "bool", "bool", "checkbox", "manual"),
        ("previous_notes", "Previous notes", "Notes before the change.", "str", "string", "textarea", "manual"),
        ("new_notes", "New notes", "Notes after the change.", "str", "string", "textarea", "manual"),
        ("changed_at", "Changed at", "When the attendance change was made.", "datetime", "datetime", "datetime", "manual"),
    ]:
        _upsert_field_description(
            bind,
            table_name="attendance_change_log",
            column_name=field[0],
            transcription=field[1],
            description=field[2],
            data_type=field[3],
            value_type=field[4],
            ui_type=field[5],
            input_mode=field[6],
            allowed_values=["external_device", "instructor"] if field[0] == "changed_by" else None,
        )

    for field in [
        ("source", "Source", "Source of the latest attendance edit.", "str", "string", "select", "manual"),
        ("device_identity_id", "Public device", "Public device that last reported this attendance.", "int", "int", "select", "lookup"),
        ("self_reported_at", "Self reported at", "When the member last edited attendance from a public device.", "datetime", "datetime", "datetime", "manual"),
        ("instructor_verified_at", "Instructor verified at", "When an instructor last edited or verified this attendance.", "datetime", "datetime", "datetime", "manual"),
    ]:
        _upsert_field_description(
            bind,
            table_name=ATTENDANCE_TABLE,
            column_name=field[0],
            transcription=field[1],
            description=field[2],
            data_type=field[3],
            value_type=field[4],
            ui_type=field[5],
            input_mode=field[6],
            allowed_values=["external_device", "instructor"] if field[0] == "source" else None,
        )


def downgrade() -> None:
    bind = op.get_bind()
    _delete_field_descriptions(
        bind,
        ["public_device_identity", "attendance_change_log"],
        ["source", "device_identity_id", "self_reported_at", "instructor_verified_at"],
    )

    with op.batch_alter_table(ATTENDANCE_TABLE, schema=None) as batch_op:
        batch_op.drop_constraint(ATTENDANCE_UNIQUE_CONSTRAINT, type_="unique")
        batch_op.drop_constraint("fk_training_session_attendance_device_identity", type_="foreignkey")
        batch_op.drop_column("instructor_verified_at")
        batch_op.drop_column("self_reported_at")
        batch_op.drop_column("device_identity_id")
        batch_op.drop_column("source")

    op.drop_index("ix_attendance_change_log_changed_at", table_name="attendance_change_log")
    op.drop_index("ix_attendance_change_log_device_identity_id", table_name="attendance_change_log")
    op.drop_index("ix_attendance_change_log_member_id", table_name="attendance_change_log")
    op.drop_index("ix_attendance_change_log_session_id", table_name="attendance_change_log")
    op.drop_index("ix_attendance_change_log_attendance_id", table_name="attendance_change_log")
    op.drop_table("attendance_change_log")

    op.drop_index("ix_public_device_identity_assigned_member_id", table_name="public_device_identity")
    op.drop_index("ix_public_device_identity_token_hash", table_name="public_device_identity")
    op.drop_table("public_device_identity")
