"""Scenario 5: duplicate monthly import — re-importing the same month must
replace, never add to, that month's spending row."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models.customer import Customer
from app.database.models.customer_monthly_spending import CustomerMonthlySpending
from app.modules.imports import service
from tests.support import create_batch, make_valid_row


async def test_reimporting_the_same_month_replaces_the_row(db_session: AsyncSession) -> None:
    batch1 = await create_batch(db_session, year=2026, month=2, file_name="feb_v1.csv")
    await service.process_chunk(
        db_session, batch1, [make_valid_row("Rahim Uddin", "01711000101", "15000")]
    )
    await db_session.commit()

    # Same month, uploaded again as a brand new ImportBatch (e.g. admin
    # re-uploads the identical file, or a corrected version of it).
    batch2 = await create_batch(db_session, year=2026, month=2, file_name="feb_v2.csv")
    result = await service.process_chunk(
        db_session, batch2, [make_valid_row("Rahim Uddin", "01711000101", "15000")]
    )
    await db_session.commit()

    assert result.new_customers == 0
    assert result.updated_customers == 1

    customer = (
        await db_session.execute(
            select(Customer).where(Customer.normalized_phone == "+8801711000101")
        )
    ).scalar_one()

    spending_rows = (
        await db_session.execute(
            select(CustomerMonthlySpending).where(
                CustomerMonthlySpending.customer_id == customer.id
            )
        )
    ).scalars().all()

    assert len(spending_rows) == 1, "must still be exactly one row for (customer, Feb 2026)"
    assert spending_rows[0].amount == Decimal("15000.00")
    assert spending_rows[0].import_batch_id == batch2.id, "latest batch is authoritative"
    assert customer.total_spent == Decimal("15000.00"), "must not double to 30000"


async def test_reimporting_the_same_month_with_a_corrected_amount_updates_it(
    db_session: AsyncSession,
) -> None:
    """A legitimate correction (not a pure re-upload) should also just
    replace the month's amount, recalculating total_spent from it."""
    batch1 = await create_batch(db_session, year=2026, month=2)
    await service.process_chunk(
        db_session, batch1, [make_valid_row("Rahim Uddin", "01711000101", "15000")]
    )
    await db_session.commit()

    batch2 = await create_batch(db_session, year=2026, month=2, file_name="feb_corrected.csv")
    await service.process_chunk(
        db_session, batch2, [make_valid_row("Rahim Uddin", "01711000101", "16500")]
    )
    await db_session.commit()

    customer = (
        await db_session.execute(
            select(Customer).where(Customer.normalized_phone == "+8801711000101")
        )
    ).scalar_one()
    assert customer.total_spent == Decimal("16500.00")
