"""Backfill member.training_start_date from registration_date

Revision ID: b7c2e1f4d9a3
Revises: a4d9f2b7c1e8
Create Date: 2026-04-21 18:50:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7c2e1f4d9a3"
down_revision: Union[str, None] = "a4d9f2b7c1e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            UPDATE member
            SET training_start_date = registration_date
            WHERE training_start_date IS NULL
              AND registration_date IS NOT NULL
            """
        )
    )


def downgrade() -> None:
    # Data backfill migration is irreversible.
    return
