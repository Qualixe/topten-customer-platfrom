"""Scenario 8: import retry / idempotency.

Exercises the *actual* Celery task body (`_process_import_batch_async`),
not just `service.process_chunk`, against a real CSV file — calling it twice
for the same ImportBatch simulates a worker retry (e.g. the worker crashed
right after finishing, redelivered the same task, and ran it again).
"""

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.customer_monthly_spending import CustomerMonthlySpending
from app.models.import_batch import ImportBatch, ImportBatchStatus
from app.tasks.imports import _process_import_batch_async
from tests.conftest import TestSessionLocal


def _write_csv(tmp_path: Path, rows: list[tuple[str, str, str]]) -> str:
    csv_path = tmp_path / "import.csv"
    lines = ["name,phone,amount"] + [f"{name},{phone},{amount}" for name, phone, amount in rows]
    csv_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return str(csv_path)


async def _create_uploaded_batch(
    db_session: AsyncSession, file_path: str, year: int, month: int
) -> ImportBatch:
    batch = ImportBatch(
        file_name="import.csv",
        file_path=file_path,
        period_year=year,
        period_month=month,
        status=ImportBatchStatus.UPLOADED.value,
    )
    db_session.add(batch)
    await db_session.commit()
    await db_session.refresh(batch)
    return batch


async def test_running_the_same_batch_twice_does_not_double_count(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    file_path = _write_csv(
        tmp_path,
        [
            ("Rahim Uddin", "01711000101", "10000"),
            ("Karim Ahmed", "01711000102", "5000"),
        ],
    )
    batch = await _create_uploaded_batch(db_session, file_path, year=2026, month=1)

    # First "attempt".
    await _process_import_batch_async(batch.id, session_factory=TestSessionLocal)
    # Simulated retry of the *same* batch (worker crash + redelivery).
    await _process_import_batch_async(batch.id, session_factory=TestSessionLocal)

    async with TestSessionLocal() as session:
        refreshed = await session.get(ImportBatch, batch.id)
        assert refreshed.status == ImportBatchStatus.COMPLETED.value
        assert refreshed.total_rows == 2
        assert refreshed.processed_rows == 2
        assert refreshed.new_customers == 2, "not 4 — retry must not double the new-customer count"

        customers = (await session.execute(select(Customer))).scalars().all()
        assert len(customers) == 2

        rahim = next(c for c in customers if c.normalized_phone == "+8801711000101")
        assert rahim.total_spent == 10000

        spending_rows = (
            await session.execute(
                select(CustomerMonthlySpending).where(
                    CustomerMonthlySpending.customer_id == rahim.id
                )
            )
        ).scalars().all()
        assert len(spending_rows) == 1, "retry must not create a second monthly-spending row"


async def test_a_batch_already_completed_is_not_reprocessed(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    file_path = _write_csv(tmp_path, [("Rahim Uddin", "01711000101", "10000")])
    batch = await _create_uploaded_batch(db_session, file_path, year=2026, month=1)

    await _process_import_batch_async(batch.id, session_factory=TestSessionLocal)

    # Mutate the file on disk after completion (simulates the file being
    # replaced) — if the batch were reprocessed, this would be picked up.
    Path(file_path).write_text(
        "name,phone,amount\nRahim Uddin,01711000101,999999\n", encoding="utf-8"
    )

    await _process_import_batch_async(batch.id, session_factory=TestSessionLocal)

    async with TestSessionLocal() as session:
        rahim = (
            await session.execute(
                select(Customer).where(Customer.normalized_phone == "+8801711000101")
            )
        ).scalar_one()
        assert rahim.total_spent == 10000, "a COMPLETED batch must be a no-op, not reprocessed"
