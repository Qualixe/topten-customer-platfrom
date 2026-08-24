"""Scenario 6: existing customer with DOB/address preservation.

Customer-submitted fields (date_of_birth, address, email) must survive a
POS import untouched, since POS files never carry them and must never null
them out.
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.services import imports as service
from tests.support import create_batch, make_valid_row


async def test_pos_import_never_overwrites_customer_submitted_fields(
    db_session: AsyncSession,
) -> None:
    jan_batch = await create_batch(db_session, year=2026, month=1)
    await service.process_chunk(
        db_session, jan_batch, [make_valid_row("Rahim Uddin", "01711000101", "10000")]
    )
    await db_session.commit()

    # Simulate the customer later filling out a promotional SMS profile form.
    customer = (
        await db_session.execute(
            select(Customer).where(Customer.normalized_phone == "+8801711000101")
        )
    ).scalar_one()
    customer.date_of_birth = date(1990, 5, 15)
    customer.address = "123 Gulshan Ave, Dhaka"
    customer.email = "rahim@example.com"
    await db_session.commit()

    # Next month's POS file only ever has name/phone/amount.
    feb_batch = await create_batch(db_session, year=2026, month=2, file_name="feb.csv")
    await service.process_chunk(
        db_session, feb_batch, [make_valid_row("Rahim Uddin", "01711000101", "15000")]
    )
    await db_session.commit()

    refreshed = (
        await db_session.execute(
            select(Customer).where(Customer.normalized_phone == "+8801711000101")
        )
    ).scalar_one()
    assert refreshed.date_of_birth == date(1990, 5, 15)
    assert refreshed.address == "123 Gulshan Ave, Dhaka"
    assert refreshed.email == "rahim@example.com"
    # POS-owned fields still update normally.
    assert refreshed.total_spent == 25000
