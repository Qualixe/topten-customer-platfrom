"""Idempotent seed of starter gift catalog items.

Run once after migrating: `python -m scripts.seed_gifts` (from `backend/`).
Safe to rerun — matched by name, so an item already in the catalog (created
here or added by hand afterward) is left untouched. `times_redeemed` always
starts at 0 — unlike the catalog structure itself, redemption history isn't
something to seed; it only ever comes from real gift orders being sent.
"""

import asyncio
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.database import SessionLocal
from app.models import GiftCatalogItem, GiftCategory

# The starter category list — after this seed runs, these are just regular
# rows in `gift_categories`; admins can rename/delete/add to them freely.
CATEGORY_NAMES = [
    "Food & Beverage",
    "Home & Living",
    "Beauty & Wellness",
    "Electronics",
    "Gift Vouchers",
    "Kids & Toys",
]

# (name, category name, description, points_cost, retail_value, stock_quantity)
CATALOG_ITEMS: list[tuple[str, str, str, int, str, int]] = [
    (
        "Premium Tea Gift Box",
        "Food & Beverage",
        "An assortment of premium loose-leaf teas in a keepsake box.",
        800,
        "1200",
        42,
    ),
    (
        "Artisan Chocolate Hamper",
        "Food & Beverage",
        "Handcrafted chocolates from local artisan makers.",
        950,
        "1450",
        30,
    ),
    (
        "Scented Candle Set",
        "Home & Living",
        "A set of three hand-poured scented candles.",
        700,
        "1100",
        6,
    ),
    (
        "Cotton Bedsheet Set",
        "Home & Living",
        "Soft cotton bedsheet set with two pillow covers.",
        1800,
        "3200",
        18,
    ),
    (
        "Ceramic Dinnerware Set",
        "Home & Living",
        "A 12-piece ceramic dinnerware set for four.",
        2400,
        "4500",
        4,
    ),
    (
        "Skincare Essentials Kit",
        "Beauty & Wellness",
        "Cleanser, toner, and moisturizer travel-size kit.",
        1100,
        "1900",
        25,
    ),
    (
        "Spa Relaxation Set",
        "Beauty & Wellness",
        "Bath salts, body oil, and a soft towel wrap.",
        1350,
        "2100",
        20,
    ),
    (
        "Electric Kettle",
        "Electronics",
        "1.7L stainless steel electric kettle with auto shut-off.",
        2200,
        "3800",
        0,
    ),
    (
        "Bluetooth Speaker",
        "Electronics",
        "Compact portable speaker with 10-hour battery life.",
        2600,
        "4200",
        15,
    ),
    (
        "Wireless Earbuds",
        "Electronics",
        "Entry-level wireless earbuds with charging case.",
        3000,
        "5000",
        5,
    ),
    (
        "৳500 Shopping Voucher",
        "Gift Vouchers",
        "Redeemable in-store voucher worth ৳500.",
        500,
        "500",
        999,
    ),
    (
        "৳1000 Shopping Voucher",
        "Gift Vouchers",
        "Redeemable in-store voucher worth ৳1,000.",
        950,
        "1000",
        999,
    ),
    (
        "৳2000 Shopping Voucher",
        "Gift Vouchers",
        "Redeemable in-store voucher worth ৳2,000.",
        1850,
        "2000",
        999,
    ),
    (
        "Building Blocks Set",
        "Kids & Toys",
        "150-piece colorful building block set for kids.",
        900,
        "1500",
        22,
    ),
    (
        "Plush Toy Bundle",
        "Kids & Toys",
        "A bundle of three soft plush toys.",
        650,
        "1000",
        28,
    ),
    (
        "Kids Art Supply Kit",
        "Kids & Toys",
        "Crayons, markers, and a sketchbook for young artists.",
        550,
        "850",
        0,
    ),
]


async def _get_or_create_category(db: AsyncSession, name: str) -> GiftCategory:
    category = (
        await db.execute(select(GiftCategory).where(GiftCategory.name == name))
    ).scalar_one_or_none()
    if category is None:
        category = GiftCategory(name=name)
        db.add(category)
        await db.flush()
        print(f"created category: {name}")
    return category


async def seed_gifts(session_factory: async_sessionmaker = SessionLocal) -> None:
    async with session_factory() as db:
        categories_by_name = {
            name: await _get_or_create_category(db, name) for name in CATEGORY_NAMES
        }

        for row in CATALOG_ITEMS:
            name, category_name, description, points_cost, retail_value, stock_quantity = row
            existing = (
                await db.execute(select(GiftCatalogItem).where(GiftCatalogItem.name == name))
            ).scalar_one_or_none()
            if existing is not None:
                continue

            db.add(
                GiftCatalogItem(
                    name=name,
                    category_id=categories_by_name[category_name].id,
                    description=description,
                    points_cost=points_cost,
                    retail_value=Decimal(retail_value),
                    stock_quantity=stock_quantity,
                )
            )
            print(f"created gift: {name}")

        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed_gifts())
