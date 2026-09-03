"""Small shared helpers for the test suite."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.phone import normalize_phone
from app.models.customer_type import CustomerType
from app.models.import_batch import ImportBatch, ImportBatchStatus
from app.services.imports_validation import ValidRow


def make_valid_row(name: str, phone: str, amount: str, row_number: int = 1) -> ValidRow:
    return ValidRow(
        row_number=row_number,
        name=name,
        raw_phone=phone,
        normalized_phone=normalize_phone(phone),
        amount=Decimal(amount),
    )


async def get_or_create_customer_type(session: AsyncSession, name: str = "General") -> CustomerType:
    """Resolves a customer type by name, creating it if missing. `customer_types`
    is truncated before every test (see conftest's `_clean_tables`, same as
    `gift_categories`), so most callers hit the create path — this just
    means the row it gets back is never `is_system` (only the real
    migration seeds those). Tests that specifically need an `is_system`
    row should construct one directly instead of going through this."""
    existing = (
        await session.execute(select(CustomerType).where(CustomerType.name == name))
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    customer_type = CustomerType(name=name)
    session.add(customer_type)
    await session.commit()
    await session.refresh(customer_type)
    return customer_type


async def get_customer_type_id(session: AsyncSession, name: str = "General") -> int:
    """The internal integer id — what `Customer.customer_type_id`/
    `ImportBatch.customer_type_id` columns actually store."""
    return (await get_or_create_customer_type(session, name)).id


async def get_customer_type_public_id(session: AsyncSession, name: str = "General") -> str:
    """The API-facing UUID — what a form/query-param sends over HTTP."""
    return str((await get_or_create_customer_type(session, name)).public_id)


async def create_batch(
    session: AsyncSession,
    year: int = 2026,
    month: int = 1,
    file_name: str = "test.csv",
    customer_type_id: int | None = None,
) -> ImportBatch:
    batch = ImportBatch(
        file_name=file_name,
        file_path=f"/tmp/{file_name}",
        period_year=year,
        period_month=month,
        status=ImportBatchStatus.PROCESSING.value,
        customer_type_id=customer_type_id or await get_customer_type_id(session),
    )
    session.add(batch)
    await session.commit()
    await session.refresh(batch)
    return batch
