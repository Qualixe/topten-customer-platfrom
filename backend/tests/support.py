"""Small shared helpers for the import test suite."""

from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.phone import normalize_phone
from app.database.models.customer import CustomerType
from app.database.models.import_batch import ImportBatch, ImportBatchStatus
from app.modules.imports.validation import ValidRow


def make_valid_row(name: str, phone: str, amount: str, row_number: int = 1) -> ValidRow:
    return ValidRow(
        row_number=row_number,
        name=name,
        raw_phone=phone,
        normalized_phone=normalize_phone(phone),
        amount=Decimal(amount),
    )


async def create_batch(
    session: AsyncSession,
    year: int = 2026,
    month: int = 1,
    file_name: str = "test.csv",
    customer_type: str = CustomerType.GENERAL.value,
) -> ImportBatch:
    batch = ImportBatch(
        file_name=file_name,
        file_path=f"/tmp/{file_name}",
        period_year=year,
        period_month=month,
        status=ImportBatchStatus.PROCESSING.value,
        customer_type=customer_type,
    )
    session.add(batch)
    await session.commit()
    await session.refresh(batch)
    return batch
