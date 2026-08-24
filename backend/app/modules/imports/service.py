"""
Chunk-processing core for POS customer imports.

Every write here is either a Postgres `INSERT ... ON CONFLICT DO UPDATE`
(upsert) or a recompute-from-source-of-truth aggregate — never an
increment — which is what makes reprocessing a chunk (whether from a
retried Celery task or a genuinely re-uploaded file) safe to repeat.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models.customer import Customer
from app.database.models.customer_monthly_spending import CustomerMonthlySpending
from app.database.models.import_batch import ImportBatch
from app.modules.imports.validation import ValidRow


@dataclass(frozen=True, slots=True)
class ChunkResult:
    new_customers: int
    updated_customers: int
    duplicate_rows: int
    chunk_amount: Decimal


def _dedupe_by_phone(rows: list[ValidRow]) -> tuple[list[ValidRow], int]:
    """Collapses rows sharing a normalized_phone within one chunk, keeping the
    last occurrence (mirrors how the final upsert would resolve them anyway).
    Returns (unique_rows, duplicate_count)."""
    by_phone: dict[str, ValidRow] = {}
    duplicate_count = 0
    for row in rows:
        if row.normalized_phone in by_phone:
            duplicate_count += 1
        by_phone[row.normalized_phone] = row
    return list(by_phone.values()), duplicate_count


async def _fetch_existing_phones(session: AsyncSession, normalized_phones: list[str]) -> set[str]:
    """Single batch query — never queries the customer table per row."""
    if not normalized_phones:
        return set()
    result = await session.execute(
        select(Customer.normalized_phone).where(Customer.normalized_phone.in_(normalized_phones))
    )
    return set(result.scalars().all())


def _resolve_customer_type_on_conflict(stmt):
    """Decides what `customer_type` becomes when an import row updates an
    already-existing customer. Currently: the type selected for *this*
    import always wins ("latest import wins"), regardless of the customer's
    previous type — see the task's own worked example (Jan GENERAL, Feb VIP
    -> VIP). To switch to a priority system instead (e.g. VVIP > VIP >
    GENERAL), replace the returned expression with a SQL CASE comparing the
    existing customers.customer_type against stmt.excluded.customer_type —
    this is the only place that needs to change."""
    return stmt.excluded.customer_type


async def _upsert_customers(
    session: AsyncSession, rows: list[ValidRow], customer_type: str
) -> dict[str, int]:
    """Bulk upserts customers by normalized_phone in one statement, returning
    {normalized_phone: customer_id}. Deliberately never touches
    date_of_birth/address/email/is_vip/status/total_spent for existing rows —
    those are customer-submitted or system-computed, not POS fields.
    `customer_type` is the one POS-driven field this *does* update on
    conflict — every row in a given import shares the same selected type."""
    if not rows:
        return {}

    now = datetime.now(UTC)
    values = [
        {
            "name": row.name,
            "phone": row.raw_phone,
            "normalized_phone": row.normalized_phone,
            "customer_type": customer_type,
            "updated_at": now,
        }
        for row in rows
    ]

    stmt = pg_insert(Customer).values(values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[Customer.normalized_phone],
        set_={
            "name": stmt.excluded.name,
            "phone": stmt.excluded.phone,
            "customer_type": _resolve_customer_type_on_conflict(stmt),
            "updated_at": stmt.excluded.updated_at,
        },
    ).returning(Customer.id, Customer.normalized_phone)

    result = await session.execute(stmt)
    return {normalized_phone: customer_id for customer_id, normalized_phone in result.all()}


async def _upsert_monthly_spending(
    session: AsyncSession,
    batch: ImportBatch,
    rows: list[ValidRow],
    phone_to_customer_id: dict[str, int],
) -> None:
    """Upserts on (customer_id, year, month) — the constraint that makes
    re-importing the same month idempotent instead of additive."""
    if not rows:
        return

    values = [
        {
            "customer_id": phone_to_customer_id[row.normalized_phone],
            "year": batch.period_year,
            "month": batch.period_month,
            "amount": row.amount,
            "import_batch_id": batch.id,
        }
        for row in rows
    ]

    stmt = pg_insert(CustomerMonthlySpending).values(values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[
            CustomerMonthlySpending.customer_id,
            CustomerMonthlySpending.year,
            CustomerMonthlySpending.month,
        ],
        set_={
            "amount": stmt.excluded.amount,
            "import_batch_id": stmt.excluded.import_batch_id,
            "updated_at": func.now(),
        },
    )
    await session.execute(stmt)


async def _recalculate_total_spent(session: AsyncSession, customer_ids: list[int]) -> None:
    """Recomputes total_spent as SUM(amount) from customer_monthly_spending —
    never `total_spent += amount` — so it's correct no matter how many times
    a given month gets reprocessed."""
    if not customer_ids:
        return

    totals_subquery = (
        select(
            CustomerMonthlySpending.customer_id,
            func.sum(CustomerMonthlySpending.amount).label("total"),
        )
        .where(CustomerMonthlySpending.customer_id.in_(customer_ids))
        .group_by(CustomerMonthlySpending.customer_id)
        .subquery()
    )

    stmt = (
        update(Customer)
        .where(Customer.id == totals_subquery.c.customer_id)
        .values(total_spent=totals_subquery.c.total)
    )
    await session.execute(stmt)


async def process_chunk(
    session: AsyncSession, batch: ImportBatch, rows: list[ValidRow]
) -> ChunkResult:
    """Processes one chunk of already-validated rows. Caller owns the
    transaction boundary (commits once per chunk, not once per file)."""
    unique_rows, duplicate_count = _dedupe_by_phone(rows)
    phones = [row.normalized_phone for row in unique_rows]

    existing_phones = await _fetch_existing_phones(session, phones)
    phone_to_customer_id = await _upsert_customers(session, unique_rows, batch.customer_type)

    await _upsert_monthly_spending(session, batch, unique_rows, phone_to_customer_id)
    await _recalculate_total_spent(session, list(phone_to_customer_id.values()))

    new_count = sum(1 for phone in phones if phone not in existing_phones)
    updated_count = len(phones) - new_count
    chunk_amount = sum((row.amount for row in unique_rows), start=Decimal("0"))

    return ChunkResult(
        new_customers=new_count,
        updated_customers=updated_count,
        duplicate_rows=duplicate_count,
        chunk_amount=chunk_amount,
    )
