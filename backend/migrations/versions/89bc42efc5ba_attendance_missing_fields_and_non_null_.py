"""attendance missing fields and non-null schedule

Revision ID: 89bc42efc5ba
Revises: b1f0e43d7a2a
Create Date: 2026-04-17 23:15:00.022796

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "89bc42efc5ba"
down_revision: Union[str, None] = "b1f0e43d7a2a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _get_column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    attendance_table = "training_session_attendance_m2m"

    # Backfill attendance table with columns that may be missing in drifted DBs.
    attendance_columns = _get_column_names(inspector, attendance_table)
    if "attended" not in attendance_columns:
        op.add_column(
            attendance_table,
            sa.Column("attended", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        )
    if "notes" not in attendance_columns:
        op.add_column(
            attendance_table,
            sa.Column("notes", sa.String(length=200), nullable=True),
        )
    if "created_at" not in attendance_columns:
        op.add_column(
            attendance_table,
            sa.Column("created_at", sa.DateTime(), nullable=True, server_default=sa.func.now()),
        )
    if "updated_at" not in attendance_columns:
        op.add_column(
            attendance_table,
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )

    # Enforce NOT NULL attended for consistent checkbox state.
    op.execute(sa.text(f"UPDATE {attendance_table} SET attended = 1 WHERE attended IS NULL"))
    with op.batch_alter_table(attendance_table, schema=None) as batch_op:
        batch_op.alter_column(
            "attended",
            existing_type=sa.Boolean(),
            nullable=False,
            existing_nullable=True,
            server_default=sa.text("1"),
        )

    # Ensure schedule linkage is mandatory for training sessions.
    null_schedule_count = bind.execute(
        sa.text("SELECT COUNT(*) FROM training_session WHERE schedule_id IS NULL")
    ).scalar_one()
    if null_schedule_count:
        raise RuntimeError(
            "Cannot make training_session.schedule_id NOT NULL: "
            f"{null_schedule_count} rows have NULL schedule_id."
        )

    with op.batch_alter_table("training_session", schema=None) as batch_op:
        batch_op.alter_column(
            "schedule_id",
            existing_type=sa.Integer(),
            nullable=False,
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("training_session", schema=None) as batch_op:
        batch_op.alter_column(
            "schedule_id",
            existing_type=sa.Integer(),
            nullable=True,
            existing_nullable=False,
        )
    with op.batch_alter_table("training_session_attendance_m2m", schema=None) as batch_op:
        batch_op.alter_column(
            "attended",
            existing_type=sa.Boolean(),
            nullable=True,
            existing_nullable=False,
        )
