"""Scenario 7: total spending calculation — the exact example from the spec.

January = 10,000
February = 15,000
March = 20,000
total_spent = 45,000

Then February is imported again -> total_spent must STILL be 45,000 (via
the task's own worked example: Jan 10,000 + Feb 15,000 = 25,000, re-import
Feb -> still 25,000, not 40,000).
"""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models.customer import Customer
from app.modules.imports import service
from tests.support import create_batch, make_valid_row

PHONE = "01711000101"


async def _get_customer(db_session: AsyncSession) -> Customer:
    query = select(Customer).where(Customer.normalized_phone == "+8801711000101")
    return (await db_session.execute(query)).scalar_one()


async def test_three_months_sum_correctly(db_session: AsyncSession) -> None:
    for month, amount in [(1, "10000"), (2, "15000"), (3, "20000")]:
        batch = await create_batch(db_session, year=2026, month=month, file_name=f"{month}.csv")
        row = make_valid_row("Rahim Uddin", PHONE, amount)
        await service.process_chunk(db_session, batch, [row])
        await db_session.commit()

    customer = await _get_customer(db_session)
    assert customer.total_spent == Decimal("45000.00")


async def test_reimporting_february_does_not_double_count(db_session: AsyncSession) -> None:
    jan = await create_batch(db_session, year=2026, month=1, file_name="jan.csv")
    await service.process_chunk(db_session, jan, [make_valid_row("Rahim Uddin", PHONE, "10000")])
    await db_session.commit()

    feb = await create_batch(db_session, year=2026, month=2, file_name="feb.csv")
    await service.process_chunk(db_session, feb, [make_valid_row("Rahim Uddin", PHONE, "15000")])
    await db_session.commit()

    customer = await _get_customer(db_session)
    assert customer.total_spent == Decimal("25000.00")

    # Import February again.
    feb_again = await create_batch(db_session, year=2026, month=2, file_name="feb_again.csv")
    await service.process_chunk(
        db_session, feb_again, [make_valid_row("Rahim Uddin", PHONE, "15000")]
    )
    await db_session.commit()

    customer = await _get_customer(db_session)
    assert customer.total_spent == Decimal("25000.00"), "must remain 25000, not 40000"
