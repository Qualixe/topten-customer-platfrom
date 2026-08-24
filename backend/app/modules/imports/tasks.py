"""
The background worker side of a POS import: reads the stored CSV in bounded
chunks (never the whole file into memory) and hands each chunk to
`app.modules.imports.service.process_chunk`.

Idempotency strategy: on every run (first attempt or retry), counters are
reset to zero and the *entire* file is reprocessed from the top. This is
simpler and more robust than resuming from a checkpoint, and it's safe
specifically because every downstream write is an upsert or a
recompute-from-source-of-truth aggregate (see service.py) — reprocessing a
row that was already applied is a no-op, never a double-count.
"""

import asyncio
import csv
from datetime import UTC, datetime

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.celery_app import celery_app
from app.core.config import settings
from app.database.database import SessionLocal, engine
from app.database.models.import_batch import ImportBatch, ImportBatchStatus
from app.database.models.import_row_error import ImportRowError
from app.modules.imports import service, validation


def _count_data_rows(file_path: str) -> int:
    """Cheap streaming line count — doesn't hold the file in memory."""
    with open(file_path, newline="", encoding="utf-8-sig") as handle:
        reader = csv.reader(handle)
        next(reader, None)  # header
        return sum(1 for _ in reader)


async def _process_one_chunk(
    session, batch: ImportBatch, raw_rows: list[dict[str, str]]
) -> None:
    valid_rows: list[validation.ValidRow] = []

    for entry in raw_rows:
        row_number = entry.pop("__row_number__")
        result = validation.validate_row(
            entry, row_number, default_phone_region=settings.IMPORT_DEFAULT_PHONE_REGION
        )
        if isinstance(result, validation.RowError):
            session.add(
                ImportRowError(
                    import_batch_id=batch.id,
                    row_number=result.row_number,
                    raw_row=result.raw_row,
                    error_message=result.message,
                )
            )
            batch.invalid_rows += 1
        else:
            valid_rows.append(result)

    if valid_rows:
        chunk_result = await service.process_chunk(session, batch, valid_rows)
        batch.new_customers += chunk_result.new_customers
        batch.updated_customers += chunk_result.updated_customers
        batch.duplicate_rows += chunk_result.duplicate_rows
        batch.total_spending += chunk_result.chunk_amount

    batch.processed_rows += len(raw_rows)
    await session.commit()


async def _process_import_batch_async(
    import_batch_id: int, session_factory: async_sessionmaker[AsyncSession] = SessionLocal
) -> None:
    """`session_factory` defaults to the production session maker; tests pass
    a test-database session maker instead, exercising the exact same
    chunk-by-chunk pipeline the Celery task runs in production."""
    async with session_factory() as session:
        batch = await session.get(ImportBatch, import_batch_id)
        if batch is None:
            return
        if batch.status == ImportBatchStatus.COMPLETED.value:
            # Already finished successfully; a stray retry is a no-op.
            return

        batch.status = ImportBatchStatus.PROCESSING.value
        batch.processed_rows = 0
        batch.new_customers = 0
        batch.updated_customers = 0
        batch.duplicate_rows = 0
        batch.invalid_rows = 0
        batch.total_spending = 0
        batch.started_at = datetime.now(UTC)
        await session.execute(
            delete(ImportRowError).where(ImportRowError.import_batch_id == batch.id)
        )
        batch.total_rows = _count_data_rows(batch.file_path)
        await session.commit()

        try:
            chunk: list[dict[str, str]] = []
            with open(batch.file_path, newline="", encoding="utf-8-sig") as handle:
                reader = csv.DictReader(handle)
                for row_number, raw_row in enumerate(reader, start=1):
                    chunk.append({"__row_number__": row_number, **raw_row})
                    if len(chunk) >= settings.IMPORT_CHUNK_SIZE:
                        await _process_one_chunk(session, batch, chunk)
                        chunk = []
                if chunk:
                    await _process_one_chunk(session, batch, chunk)

            batch.status = (
                ImportBatchStatus.COMPLETED_WITH_ERRORS.value
                if batch.invalid_rows > 0
                else ImportBatchStatus.COMPLETED.value
            )
            batch.completed_at = datetime.now(UTC)
            await session.commit()
        except Exception:
            await session.rollback()
            batch.status = ImportBatchStatus.FAILED.value
            batch.completed_at = datetime.now(UTC)
            await session.commit()
            raise


async def _run_and_dispose(import_batch_id: int) -> None:
    # Each Celery task invocation runs its own `asyncio.run()`, which spins
    # up a brand new event loop — but the async engine's connection pool
    # (module-level, created once at import time) would otherwise stay
    # bound to whichever loop first used it, breaking every task after the
    # first ("attached to a different loop"). Disposing the pool at the end
    # of every task forces the next task to lazily open fresh connections
    # bound to *its* loop.
    try:
        await _process_import_batch_async(import_batch_id)
    finally:
        await engine.dispose()


@celery_app.task(
    name="imports.process_import_batch",
    bind=True,
    acks_late=True,
    max_retries=3,
    default_retry_delay=30,
)
def process_import_batch(self, import_batch_id: int) -> None:
    asyncio.run(_run_and_dispose(import_batch_id))
