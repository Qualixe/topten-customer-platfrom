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
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.database import SessionLocal
from app.models import GiftCatalogItem, GiftCategory

# (name, category, description, points_cost, retail_value, stock_quantity)
CATALOG_ITEMS: list[tuple[str, GiftCategory, str, int, str, int]] = [
    (
        "Premium Tea Gift Box",
        GiftCategory.FOOD_AND_BEVERAGE,
        "An assortment of premium loose-leaf teas in a keepsake box.",
        800,
        "1200",
        42,
    ),
    (
        "Artisan Chocolate Hamper",
        GiftCategory.FOOD_AND_BEVERAGE,
        "Handcrafted chocolates from local artisan makers.",
        950,
        "1450",
        30,
    ),
    (
        "Scented Candle Set",
        GiftCategory.HOME_AND_LIVING,
        "A set of three hand-poured scented candles.",
        700,
        "1100",
        6,
    ),
    (
        "Cotton Bedsheet Set",
        GiftCategory.HOME_AND_LIVING,
        "Soft cotton bedsheet set with two pillow covers.",
        1800,
        "3200",
        18,
    ),
    (
        "Ceramic Dinnerware Set",
        GiftCategory.HOME_AND_LIVING,
        "A 12-piece ceramic dinnerware set for four.",
        2400,
        "4500",
        4,
    ),
    (
        "Skincare Essentials Kit",
        GiftCategory.BEAUTY_AND_WELLNESS,
        "Cleanser, toner, and moisturizer travel-size kit.",
        1100,
        "1900",
        25,
    ),
    (
        "Spa Relaxation Set",
        GiftCategory.BEAUTY_AND_WELLNESS,
        "Bath salts, body oil, and a soft towel wrap.",
        1350,
        "2100",
        20,
    ),
    (
        "Electric Kettle",
        GiftCategory.ELECTRONICS,
        "1.7L stainless steel electric kettle with auto shut-off.",
        2200,
        "3800",
        0,
    ),
    (
        "Bluetooth Speaker",
        GiftCategory.ELECTRONICS,
        "Compact portable speaker with 10-hour battery life.",
        2600,
        "4200",
        15,
    ),
    (
        "Wireless Earbuds",
        GiftCategory.ELECTRONICS,
        "Entry-level wireless earbuds with charging case.",
        3000,
        "5000",
        5,
    ),
    (
        "৳500 Shopping Voucher",
        GiftCategory.GIFT_VOUCHERS,
        "Redeemable in-store voucher worth ৳500.",
        500,
        "500",
        999,
    ),
    (
        "৳1000 Shopping Voucher",
        GiftCategory.GIFT_VOUCHERS,
        "Redeemable in-store voucher worth ৳1,000.",
        950,
        "1000",
        999,
    ),
    (
        "৳2000 Shopping Voucher",
        GiftCategory.GIFT_VOUCHERS,
        "Redeemable in-store voucher worth ৳2,000.",
        1850,
        "2000",
        999,
    ),
    (
        "Building Blocks Set",
        GiftCategory.KIDS_AND_TOYS,
        "150-piece colorful building block set for kids.",
        900,
        "1500",
        22,
    ),
    (
        "Plush Toy Bundle",
        GiftCategory.KIDS_AND_TOYS,
        "A bundle of three soft plush toys.",
        650,
        "1000",
        28,
    ),
    (
        "Kids Art Supply Kit",
        GiftCategory.KIDS_AND_TOYS,
        "Crayons, markers, and a sketchbook for young artists.",
        550,
        "850",
        0,
    ),
]


async def seed_gifts(session_factory: async_sessionmaker = SessionLocal) -> None:
    async with session_factory() as db:
        for name, category, description, points_cost, retail_value, stock_quantity in CATALOG_ITEMS:
            existing = (
                await db.execute(select(GiftCatalogItem).where(GiftCatalogItem.name == name))
            ).scalar_one_or_none()
            if existing is not None:
                continue

            db.add(
                GiftCatalogItem(
                    name=name,
                    category=category.value,
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
