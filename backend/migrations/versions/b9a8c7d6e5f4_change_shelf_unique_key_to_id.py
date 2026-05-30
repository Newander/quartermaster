"""Change shelf unique key from shelf number to id

Revision ID: b9a8c7d6e5f4
Revises: f2a9c7e4d1b8
Create Date: 2026-05-25 22:05:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b9a8c7d6e5f4"
down_revision: Union[str, None] = "f2a9c7e4d1b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SHELF_TABLE = "shelf"
SHELF_NUMBER_UNIQUE_FALLBACK = "uq_shelf_shelf_number"
SHELF_ID_UNIQUE = "uq_shelf_id"
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def _unique_constraints_by_columns(
    inspector: sa.Inspector,
    table_name: str,
    column_names: list[str],
) -> list[str]:
    expected_columns = set(column_names)
    return [
        constraint["name"]
        for constraint in inspector.get_unique_constraints(table_name)
        if constraint.get("name")
        and set(constraint.get("column_names") or []) == expected_columns
    ]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    shelf_number_unique_constraints = _unique_constraints_by_columns(
        inspector,
        SHELF_TABLE,
        ["shelf_number"],
    )
    if not shelf_number_unique_constraints:
        shelf_number_unique_constraints = [SHELF_NUMBER_UNIQUE_FALLBACK]

    id_unique_constraints = _unique_constraints_by_columns(
        inspector,
        SHELF_TABLE,
        ["id"],
    )

    with op.batch_alter_table(
        SHELF_TABLE,
        schema=None,
        naming_convention=NAMING_CONVENTION,
    ) as batch_op:
        for constraint_name in shelf_number_unique_constraints:
            batch_op.drop_constraint(constraint_name, type_="unique")

        if not id_unique_constraints:
            batch_op.create_unique_constraint(SHELF_ID_UNIQUE, ["id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    id_unique_constraints = _unique_constraints_by_columns(
        inspector,
        SHELF_TABLE,
        ["id"],
    )
    shelf_number_unique_constraints = _unique_constraints_by_columns(
        inspector,
        SHELF_TABLE,
        ["shelf_number"],
    )

    with op.batch_alter_table(
        SHELF_TABLE,
        schema=None,
        naming_convention=NAMING_CONVENTION,
    ) as batch_op:
        for constraint_name in id_unique_constraints:
            batch_op.drop_constraint(constraint_name, type_="unique")

        if not shelf_number_unique_constraints:
            batch_op.create_unique_constraint(
                SHELF_NUMBER_UNIQUE_FALLBACK,
                ["shelf_number"],
            )
