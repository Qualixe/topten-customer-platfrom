"""Scenario 1: new customer import."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models.customer import Customer
from app.database.models.customer_monthly_spending import CustomerMonthlySpending
from app.modules.imports import service
from tests.support import create_batch, make_valid_row


async def test_new_phone_creates_a_new_customer(db_session: AsyncSession) -> None:
    batch = await create_batch(db_session, year=2026, month=1)
    row = make_valid_row("Rahim Uddin", "01711000101", "10000")

    result = await service.process_chunk(db_session, batch, [row])
    await db_session.commit()

    assert result.new_customers == 1
    assert result.updated_customers == 0

    customer = (
        await db_session.execute(
            select(Customer).where(Customer.normalized_phone == "+8801711000101")
        )
    ).scalar_one()
    assert customer.name == "Rahim Uddin"
    assert customer.total_spent == Decimal("10000.00")
    assert customer.date_of_birth is None
    assert customer.address is None
    assert customer.email is None


async def test_new_customer_gets_exactly_one_monthly_spending_row(
    db_session: AsyncSession,
) -> None:
    batch = await create_batch(db_session, year=2026, month=1)
    row = make_valid_row("Karim Ahmed", "01711000102", "5000")

    await service.process_chunk(db_session, batch, [row])
    await db_session.commit()

    customer = (
        await db_session.execute(
            select(Customer).where(Customer.normalized_phone == "+8801711000102")
        )
    ).scalar_one()
    rows = (
        await db_session.execute(
            select(CustomerMonthlySpending).where(
                CustomerMonthlySpending.customer_id == customer.id
            )
        )
    ).scalars().all()

    assert len(rows) == 1
    assert rows[0].year == 2026
    assert rows[0].month == 1
    assert rows[0].amount == Decimal("5000.00")


async def test_multiple_new_customers_in_one_chunk(db_session: AsyncSession) -> None:
    batch = await create_batch(db_session, year=2026, month=1)
    rows = [
        make_valid_row("Rahim Uddin", "01711000101", "10000", row_number=1),
        make_valid_row("Karim Ahmed", "01711000102", "5000", row_number=2),
        make_valid_row("Nasrin Akter", "01711000103", "7500", row_number=3),
    ]

    result = await service.process_chunk(db_session, batch, rows)
    await db_session.commit()

    assert result.new_customers == 3
    assert result.updated_customers == 0
    assert result.chunk_amount == Decimal("22500")
