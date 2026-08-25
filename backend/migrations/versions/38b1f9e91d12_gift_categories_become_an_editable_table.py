"""gift categories become an editable table

Revision ID: 38b1f9e91d12
Revises: 510159fe54b4
Create Date: 2026-08-25 17:22:11.499240

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '38b1f9e91d12'
down_revision: Union[str, None] = '510159fe54b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FK_NAME = "fk_gift_catalog_items_category_id_gift_categories"

# (old enum value, new display name) — the fixed list this migration
# replaces with a real, admin-editable table.
LEGACY_CATEGORIES = [
    ("FOOD_AND_BEVERAGE", "Food & Beverage"),
    ("HOME_AND_LIVING", "Home & Living"),
    ("BEAUTY_AND_WELLNESS", "Beauty & Wellness"),
    ("ELECTRONICS", "Electronics"),
    ("GIFT_VOUCHERS", "Gift Vouchers"),
    ("KIDS_AND_TOYS", "Kids & Toys"),
]


def upgrade() -> None:
    op.create_table(
        "gift_categories",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("public_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
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
        op.f("ix_gift_categories_public_id"), "gift_categories", ["public_id"], unique=True
    )

    # Seed the categories that existed as a fixed enum before this migration
    # so existing gift_catalog_items rows have somewhere to point once
    # category_id is backfilled below.
    gift_categories = sa.table(
        "gift_categories",
        sa.column("public_id", sa.UUID()),
        sa.column("name", sa.String()),
    )
    op.bulk_insert(
        gift_categories,
        [{"public_id": str(uuid.uuid4()), "name": name} for _, name in LEGACY_CATEGORIES],
    )

    op.add_column("gift_catalog_items", sa.Column("category_id", sa.Integer(), nullable=True))

    for old_value, new_name in LEGACY_CATEGORIES:
        op.execute(
            sa.text(
                """
                UPDATE gift_catalog_items
                SET category_id = gift_categories.id
                FROM gift_categories
                WHERE gift_catalog_items.category = :old_value
                  AND gift_categories.name = :new_name
                """
            ).bindparams(old_value=old_value, new_name=new_name)
        )

    op.alter_column("gift_catalog_items", "category_id", nullable=False)

    op.drop_index("ix_gift_catalog_items_category", table_name="gift_catalog_items")
    op.create_index(
        op.f("ix_gift_catalog_items_category_id"), "gift_catalog_items", ["category_id"], unique=False
    )
    op.create_foreign_key(
        FK_NAME,
        "gift_catalog_items",
        "gift_categories",
        ["category_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.drop_column("gift_catalog_items", "category")


def downgrade() -> None:
    op.add_column(
        "gift_catalog_items", sa.Column("category", sa.VARCHAR(length=30), nullable=True)
    )

    for old_value, new_name in LEGACY_CATEGORIES:
        op.execute(
            sa.text(
                """
                UPDATE gift_catalog_items
                SET category = :old_value
                FROM gift_categories
                WHERE gift_catalog_items.category_id = gift_categories.id
                  AND gift_categories.name = :new_name
                """
            ).bindparams(old_value=old_value, new_name=new_name)
        )
    # Any category created after this migration ran (not one of the
    # original 6) has no enum equivalent — fall back to the first legacy
    # value rather than leaving it null.
    op.execute(
        sa.text("UPDATE gift_catalog_items SET category = :fallback WHERE category IS NULL").bindparams(
            fallback=LEGACY_CATEGORIES[0][0]
        )
    )

    op.alter_column("gift_catalog_items", "category", nullable=False)

    op.drop_constraint(FK_NAME, "gift_catalog_items", type_="foreignkey")
    op.drop_index(op.f("ix_gift_catalog_items_category_id"), table_name="gift_catalog_items")
    op.create_index("ix_gift_catalog_items_category", "gift_catalog_items", ["category"], unique=False)
    op.drop_column("gift_catalog_items", "category_id")

    op.drop_index(op.f("ix_gift_categories_public_id"), table_name="gift_categories")
    op.drop_table("gift_categories")
