"""Add racks and replace shelf location with rack reference

Revision ID: c1d2e3f4a5b6
Revises: b9a8c7d6e5f4
Create Date: 2026-05-25 22:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "b9a8c7d6e5f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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
) -> None:
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

    payload = {
        "table_name": table_name,
        "column_name": column_name,
        "transcription": transcription,
        "description": description,
        "data_type": data_type,
        "value_type": value_type,
        "ui_type": ui_type,
        "input_mode": input_mode,
    }

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
                )
                VALUES (
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

    op.create_table(
        "rack",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=250), nullable=False),
        sa.Column("owner", sa.String(length=250), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    with op.batch_alter_table("rack", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_rack_id"), ["id"], unique=False)

    bind.execute(
        sa.text(
            """
            INSERT INTO rack (name, owner, is_deleted)
            SELECT DISTINCT COALESCE(NULLIF(TRIM(location), ''), 'Default rack'), NULL, 0
            FROM shelf
            """
        )
    )
    bind.execute(
        sa.text(
            """
            INSERT INTO rack (name, owner, is_deleted)
            SELECT 'Default rack', NULL, 0
            WHERE NOT EXISTS (SELECT 1 FROM rack)
            """
        )
    )

    with op.batch_alter_table("shelf", schema=None) as batch_op:
        batch_op.add_column(sa.Column("rack_id", sa.Integer(), nullable=True))

    bind.execute(
        sa.text(
            """
            UPDATE shelf
            SET rack_id = (
                SELECT rack.id
                FROM rack
                WHERE rack.name = COALESCE(NULLIF(TRIM(shelf.location), ''), 'Default rack')
                LIMIT 1
            )
            """
        )
    )

    with op.batch_alter_table("shelf", schema=None) as batch_op:
        batch_op.alter_column("rack_id", existing_type=sa.Integer(), nullable=False)
        batch_op.create_foreign_key(
            "fk_shelf_rack_id_rack",
            "rack",
            ["rack_id"],
            ["id"],
        )
        batch_op.drop_column("location")

    bind.execute(
        sa.text(
            """
            DELETE FROM field_description
            WHERE table_name = 'shelf' AND column_name = 'location'
            """
        )
    )

    for field in [
        ("rack", "name", "Nazwa", "Unikalna nazwa stojaka.", "str", "string", "text", "manual"),
        ("rack", "owner", "Właściciel", "Osoba, której przypisane są wszystkie półki w stojaku.", "str", "string", "text", "manual"),
        ("rack", "is_deleted", "Usunięty", "Czy stojak jest oznaczony jako usunięty.", "bool", "bool", "checkbox", "manual"),
        ("shelf", "rack_id", "Stojak", "Stojak, w którym znajduje się półka.", "int", "int", "select", "lookup"),
    ]:
        _upsert_field_description(
            bind,
            table_name=field[0],
            column_name=field[1],
            transcription=field[2],
            description=field[3],
            data_type=field[4],
            value_type=field[5],
            ui_type=field[6],
            input_mode=field[7],
        )


def downgrade() -> None:
    bind = op.get_bind()

    with op.batch_alter_table("shelf", schema=None) as batch_op:
        batch_op.add_column(sa.Column("location", sa.String(length=200), nullable=True))

    bind.execute(
        sa.text(
            """
            UPDATE shelf
            SET location = (
                SELECT rack.name
                FROM rack
                WHERE rack.id = shelf.rack_id
                LIMIT 1
            )
            """
        )
    )

    with op.batch_alter_table("shelf", schema=None) as batch_op:
        batch_op.drop_constraint("fk_shelf_rack_id_rack", type_="foreignkey")
        batch_op.drop_column("rack_id")

    with op.batch_alter_table("rack", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_rack_id"))
    op.drop_table("rack")

    bind.execute(
        sa.text(
            """
            DELETE FROM field_description
            WHERE (table_name = 'rack')
               OR (table_name = 'shelf' AND column_name = 'rack_id')
            """
        )
    )
    _upsert_field_description(
        bind,
        table_name="shelf",
        column_name="location",
        transcription="Lokalizacja",
        description="Miejsce, w którym znajduje się półka.",
        data_type="str",
        value_type="string",
        ui_type="text",
        input_mode="manual",
    )
