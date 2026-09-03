"""customer types become an editable table

Revision ID: 4ab34f0bffe6
Revises: f1c86ee32246
Create Date: 2026-09-03 13:42:29.074307

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4ab34f0bffe6'
down_revision: Union[str, None] = 'f1c86ee32246'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FK_CUSTOMERS_NAME = "fk_customers_customer_type_id_customer_types"
FK_IMPORT_BATCHES_NAME = "fk_import_batches_customer_type_id_customer_types"

# (old enum value, new display name) — the fixed list this migration
# replaces with a real, admin-editable table. is_system=True protects these
# three rows from rename/delete (see app.services.customer_types) — SMS
# campaign audience targeting resolves them by exact name and deliberately
# never extends to arbitrary admin-added types.
LEGACY_TYPES = [
    ("GENERAL", "General"),
    ("VIP", "VIP"),
    ("VVIP", "VVIP"),
]


def upgrade() -> None:
    op.create_table(
        "customer_types",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("public_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("is_system", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(
        op.f("ix_customer_types_public_id"), "customer_types", ["public_id"], unique=True
    )

    # Seed the types that existed as a fixed enum before this migration so
    # existing customers/import_batches rows have somewhere to point once
    # customer_type_id is backfilled below.
    customer_types = sa.table(
        "customer_types",
        sa.column("public_id", sa.UUID()),
        sa.column("name", sa.String()),
        sa.column("is_system", sa.Boolean()),
    )
    op.bulk_insert(
        customer_types,
        [{"public_id": str(uuid.uuid4()), "name": name, "is_system": True} for _, name in LEGACY_TYPES],
    )

    # --- customers ---
    op.add_column("customers", sa.Column("customer_type_id", sa.Integer(), nullable=True))
    for old_value, new_name in LEGACY_TYPES:
        op.execute(
            sa.text(
                """
                UPDATE customers
                SET customer_type_id = customer_types.id
                FROM customer_types
                WHERE customers.customer_type = :old_value
                  AND customer_types.name = :new_name
                """
            ).bindparams(old_value=old_value, new_name=new_name)
        )
    op.alter_column("customers", "customer_type_id", nullable=False)

    op.drop_index(op.f("ix_customers_customer_type"), table_name="customers")
    op.create_index(
        op.f("ix_customers_customer_type_id"), "customers", ["customer_type_id"], unique=False
    )
    op.create_foreign_key(
        FK_CUSTOMERS_NAME,
        "customers",
        "customer_types",
        ["customer_type_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.drop_column("customers", "customer_type")

    # --- import_batches (no pre-existing index to drop) ---
    op.add_column("import_batches", sa.Column("customer_type_id", sa.Integer(), nullable=True))
    for old_value, new_name in LEGACY_TYPES:
        op.execute(
            sa.text(
                """
                UPDATE import_batches
                SET customer_type_id = customer_types.id
                FROM customer_types
                WHERE import_batches.customer_type = :old_value
                  AND customer_types.name = :new_name
                """
            ).bindparams(old_value=old_value, new_name=new_name)
        )
    op.alter_column("import_batches", "customer_type_id", nullable=False)
    op.create_foreign_key(
        FK_IMPORT_BATCHES_NAME,
        "import_batches",
        "customer_types",
        ["customer_type_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.drop_column("import_batches", "customer_type")


def downgrade() -> None:
    # --- import_batches ---
    op.add_column(
        "import_batches", sa.Column("customer_type", sa.VARCHAR(length=20), nullable=True)
    )
    for old_value, new_name in LEGACY_TYPES:
        op.execute(
            sa.text(
                """
                UPDATE import_batches
                SET customer_type = :old_value
                FROM customer_types
                WHERE import_batches.customer_type_id = customer_types.id
                  AND customer_types.name = :new_name
                """
            ).bindparams(old_value=old_value, new_name=new_name)
        )
    # Any type created after this migration ran (not one of the original
    # three) has no enum equivalent — fall back to GENERAL rather than
    # leaving it null.
    op.execute(
        sa.text(
            "UPDATE import_batches SET customer_type = :fallback WHERE customer_type IS NULL"
        ).bindparams(fallback=LEGACY_TYPES[0][0])
    )
    op.alter_column("import_batches", "customer_type", nullable=False)
    op.drop_constraint(FK_IMPORT_BATCHES_NAME, "import_batches", type_="foreignkey")
    op.drop_column("import_batches", "customer_type_id")

    # --- customers ---
    op.add_column("customers", sa.Column("customer_type", sa.VARCHAR(length=20), nullable=True))
    for old_value, new_name in LEGACY_TYPES:
        op.execute(
            sa.text(
                """
                UPDATE customers
                SET customer_type = :old_value
                FROM customer_types
                WHERE customers.customer_type_id = customer_types.id
                  AND customer_types.name = :new_name
                """
            ).bindparams(old_value=old_value, new_name=new_name)
        )
    op.execute(
        sa.text(
            "UPDATE customers SET customer_type = :fallback WHERE customer_type IS NULL"
        ).bindparams(fallback=LEGACY_TYPES[0][0])
    )
    op.alter_column("customers", "customer_type", nullable=False)
    op.drop_constraint(FK_CUSTOMERS_NAME, "customers", type_="foreignkey")
    op.drop_index(op.f("ix_customers_customer_type_id"), table_name="customers")
    op.create_index("ix_customers_customer_type", "customers", ["customer_type"], unique=False)
    op.drop_column("customers", "customer_type_id")

    op.drop_index(op.f("ix_customer_types_public_id"), table_name="customer_types")
    op.drop_table("customer_types")
