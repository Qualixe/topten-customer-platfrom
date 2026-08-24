"""Scenario 4: duplicate phone (same phone appears more than once)."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models.customer import Customer
from app.database.models.customer_monthly_spending import CustomerMonthlySpending
from app.modules.imports import service
from tests.support import create_batch, make_valid_row


async def test_same_phone_twice_in_one_file_creates_only_one_customer(
    db_session: AsyncSession,
) -> None:
    batch = await create_batch(db_session, year=2026, month=1)
    rows = [
        make_valid_row("Rahim Uddin", "01711000101", "5000", row_number=1),
        make_valid_row("Rahim Uddin", "01711000101", "7000", row_number=2),
    ]

    result = await service.process_chunk(db_session, batch, rows)
    await db_session.commit()

    assert result.new_customers == 1
    assert result.duplicate_rows == 1

    customers = (
        await db_session.execute(
            select(Customer).where(Customer.normalized_phone == "+8801711000101")
        )
    ).scalars().all()
    assert len(customers) == 1


async def test_duplicate_phone_last_value_wins_and_is_not_summed(
    db_session: AsyncSession,
) -> None:
    """The last occurrence's amount wins — duplicates are collapsed, not
    added together (10000 + 7000 must not become 17000)."""
    batch = await create_batch(db_session, year=2026, month=1)
    rows = [
        make_valid_row("Rahim Uddin", "01711000101", "10000", row_number=1),
        make_valid_row("Rahim Uddin", "01711000101", "7000", row_number=2),
    ]

    await service.process_chunk(db_session, batch, rows)
    await db_session.commit()

    customer = (
        await db_session.execute(
            select(Customer).where(Customer.normalized_phone == "+8801711000101")
        )
    ).scalar_one()
    assert customer.total_spent == Decimal("7000.00")

    spending_rows = (
        await db_session.execute(
            select(CustomerMonthlySpending).where(
                CustomerMonthlySpending.customer_id == customer.id
            )
        )
    ).scalars().all()
    assert len(spending_rows) == 1
    assert spending_rows[0].amount == Decimal("7000.00")
