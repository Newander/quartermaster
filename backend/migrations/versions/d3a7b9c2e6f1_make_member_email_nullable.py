"""Make member email nullable

Revision ID: d3a7b9c2e6f1
Revises: c1d2e3f4a5b6
Create Date: 2026-05-26 23:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d3a7b9c2e6f1"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("member", schema=None) as batch_op:
        batch_op.alter_column(
            "email",
            existing_type=sa.String(length=320),
            existing_nullable=False,
            nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("member", schema=None) as batch_op:
        batch_op.alter_column(
            "email",
            existing_type=sa.String(length=320),
            existing_nullable=True,
            nullable=False,
        )
