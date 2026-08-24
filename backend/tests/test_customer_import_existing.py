"""Scenario 2: existing customer import (matched by phone, not name)."""


from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models.customer import Customer
from app.modules.imports import service
from tests.support import create_batch, make_valid_row


async def test_second_import_updates_rather_than_duplicates(db_session: AsyncSession) -> None:
    jan_batch = await create_batch(db_session, year=2026, month=1)
    await service.process_chunk(
        db_session, jan_batch, [make_valid_row("Rahim Uddin", "01711000101", "10000")]
    )
    await db_session.commit()

    feb_batch = await create_batch(db_session, year=2026, month=2)
    result = await service.process_chunk(
        db_session, feb_batch, [make_valid_row("Rahim Uddin", "01711000101", "15000")]
    )
    await db_session.commit()

    assert result.new_customers == 0
    assert result.updated_customers == 1

    customers = (
        await db_session.execute(
            select(Customer).where(Customer.normalized_phone == "+8801711000101")
        )
    ).scalars().all()
    assert len(customers) == 1, "must not create a second customer for the same phone"


async def test_matching_is_by_phone_not_name(db_session: AsyncSession) -> None:
    """Two different phone numbers with the same name are two different
    customers; the same phone number is always the same customer even if
    the POS-reported name spelling differs slightly."""
    batch = await create_batch(db_session, year=2026, month=1)

    await service.process_chunk(
        db_session,
        batch,
        [
            make_valid_row("Md. Rahim Uddin", "01711000101", "1000", row_number=1),
            make_valid_row("Md. Rahim Uddin", "01711000199", "1000", row_number=2),
        ],
    )
    await db_session.commit()

    same_name_customers = (
        await db_session.execute(select(Customer).where(Customer.name == "Md. Rahim Uddin"))
    ).scalars().all()
    assert len(same_name_customers) == 2, "same name, different phones -> different customers"

    # Re-import under a *different* name but the *same* phone -> same customer, name updated.
    batch2 = await create_batch(db_session, year=2026, month=2, file_name="feb.csv")
    result = await service.process_chunk(
        db_session, batch2, [make_valid_row("R. Uddin", "01711000101", "2000")]
    )
    await db_session.commit()

    assert result.updated_customers == 1

    # `process_chunk` upserts via Core (bypassing the ORM), so the identity
    # map's already-loaded Customer object (from the `same_name_customers`
    # query above) is now stale — expire it so this query re-reads the row.
    db_session.expire_all()
    customer = (
        await db_session.execute(
            select(Customer).where(Customer.normalized_phone == "+8801711000101")
        )
    ).scalar_one()
    assert customer.name == "R. Uddin"
