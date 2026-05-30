"""Add refresh token sessions

Revision ID: b1f0e43d7a2a
Revises: 8e4a7c2c1f6b
Create Date: 2026-04-17 20:20:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b1f0e43d7a2a"
down_revision: Union[str, None] = "8e4a7c2c1f6b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "refresh_token_session",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("replaced_by_jti", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True, server_onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("refresh_token_session", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_refresh_token_session_id"), ["id"], unique=False)
        batch_op.create_index(batch_op.f("ix_refresh_token_session_jti"), ["jti"], unique=True)
        batch_op.create_index(batch_op.f("ix_refresh_token_session_user_id"), ["user_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("refresh_token_session", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_refresh_token_session_user_id"))
        batch_op.drop_index(batch_op.f("ix_refresh_token_session_jti"))
        batch_op.drop_index(batch_op.f("ix_refresh_token_session_id"))

    op.drop_table("refresh_token_session")
