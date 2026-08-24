"""Scenario 10: large batch processing — exercises real multi-chunk
processing (default IMPORT_CHUNK_SIZE=500), not just a single chunk."""

from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.customer import Customer
from app.models.customer_monthly_spending import CustomerMonthlySpending
from app.models.import_batch import ImportBatch, ImportBatchStatus
from app.tasks.imports import _process_import_batch_async
from tests.conftest import TestSessionLocal

ROW_COUNT = 1200  # spans 3 chunks at the default chunk size of 500


def _write_large_csv(tmp_path: Path) -> str:
    csv_path = tmp_path / "large_import.csv"
    lines = ["name,phone,amount"]
    for i in range(ROW_COUNT):
        # +8801700000000 + i -> ROW_COUNT distinct, validly-formatted numbers.
        phone = f"017{(i % 10_000_000):08d}"
        lines.append(f"Customer {i},{phone},{100 + i}")
    csv_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return str(csv_path)


async def test_large_file_is_processed_in_multiple_chunks(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    assert ROW_COUNT > settings.IMPORT_CHUNK_SIZE, "test assumes multiple chunks are required"

    file_path = _write_large_csv(tmp_path)
    batch = ImportBatch(
        file_name="large_import.csv",
        file_path=file_path,
        period_year=2026,
        period_month=1,
        status=ImportBatchStatus.UPLOADED.value,
    )
    db_session.add(batch)
    await db_session.commit()
    await db_session.refresh(batch)

    await _process_import_batch_async(batch.id, session_factory=TestSessionLocal)

    async with TestSessionLocal() as session:
        refreshed = await session.get(ImportBatch, batch.id)
        assert refreshed.status == ImportBatchStatus.COMPLETED.value
        assert refreshed.total_rows == ROW_COUNT
        assert refreshed.processed_rows == ROW_COUNT
        assert refreshed.new_customers == ROW_COUNT
        assert refreshed.invalid_rows == 0

        customer_count_query = select(func.count()).select_from(Customer)
        customer_count = (await session.execute(customer_count_query)).scalar_one()
        assert customer_count == ROW_COUNT

        spending_count = (
            await session.execute(select(func.count()).select_from(CustomerMonthlySpending))
        ).scalar_one()
        assert spending_count == ROW_COUNT
