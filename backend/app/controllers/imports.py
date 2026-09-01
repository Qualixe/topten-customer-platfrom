import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db, require_permission
from app.common.exceptions import NotFoundError, ValidationAppError
from app.core.config import settings
from app.models.customer import CustomerType
from app.models.import_batch import ImportBatch, ImportBatchStatus
from app.models.import_row_error import ImportRowError
from app.services.imports_validation import InvalidPeriodError, validate_period
from app.tasks.imports import process_import_batch
from app.views.imports import (
    ImportBatchCreateData,
    ImportBatchCreateResponse,
    ImportBatchListResponse,
    ImportBatchRead,
    ImportBatchReadResponse,
    ImportRowErrorListResponse,
    ImportRowErrorRead,
)

router = APIRouter(dependencies=[Depends(require_permission("imports.manage"))])

UPLOAD_READ_CHUNK_SIZE = 1024 * 1024  # 1 MB — streamed to disk, never buffered whole.
MAX_IMPORT_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB — generous for a POS CSV export.


@router.post(
    "/customers", status_code=status.HTTP_201_CREATED, response_model=ImportBatchCreateResponse
)
async def upload_customer_import(
    period_year: int = Form(..., description="Calendar year this POS export covers"),
    period_month: int = Form(..., description="Calendar month (1-12) this POS export covers"),
    customer_type: CustomerType = Form(
        ..., description="Customer category this whole file is imported as"
    ),
    file: UploadFile = File(..., description="POS export CSV: name, phone, amount columns"),
    db: AsyncSession = Depends(get_db),
) -> ImportBatchCreateResponse:
    """
    1. Validate the file/period. 2. Create the ImportBatch row. 3. Stream the
    upload to disk. 4. Queue Celery processing. 5. Return the import id and
    status — the actual row-by-row work happens in
    app.tasks.imports.process_import_batch, not in this request.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise ValidationAppError("Only .csv files are accepted")

    try:
        validate_period(period_year, period_month)
    except InvalidPeriodError as exc:
        raise ValidationAppError(str(exc)) from exc

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    # Only the extension from the client filename is trusted for the stored
    # path — the rest of the name is user-controlled and stored separately
    # on the batch row (file_name) for display, never used as a path segment.
    destination = upload_dir / f"{uuid.uuid4()}{Path(file.filename).suffix}"

    total_bytes = 0
    raw_chunks: list[bytes] = []
    try:
        with destination.open("wb") as out_file:
            while chunk := await file.read(UPLOAD_READ_CHUNK_SIZE):
                total_bytes += len(chunk)
                if total_bytes > MAX_IMPORT_SIZE_BYTES:
                    raise ValidationAppError("Import file must be smaller than 50 MB")
                out_file.write(chunk)
                raw_chunks.append(chunk)
    except ValidationAppError:
        destination.unlink(missing_ok=True)
        raise

    # Passed straight to the Celery task rather than relied on being re-read
    # from `destination` — the worker may run in a separate
    # container/filesystem from this API process (e.g. on Railway, where
    # services don't share a disk), so a path written here can be invisible
    # to it. Still written to disk above too, for deployments where backend
    # and celery-worker do share a volume (see docker-compose.prod.yml).
    file_content = b"".join(raw_chunks).decode("utf-8-sig", errors="replace")

    batch = ImportBatch(
        file_name=file.filename,
        file_path=str(destination),
        period_year=period_year,
        period_month=period_month,
        customer_type=customer_type.value,
        status=ImportBatchStatus.UPLOADED.value,
    )
    db.add(batch)
    await db.commit()
    await db.refresh(batch)

    process_import_batch.delay(batch.id, file_content)

    return ImportBatchCreateResponse(
        data=ImportBatchCreateData(
            import_id=batch.public_id,
            status=ImportBatchStatus(batch.status),
            customer_type=customer_type,
        )
    )


@router.get("", response_model=ImportBatchListResponse)
async def list_import_batches(
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
    offset: int = 0,
) -> ImportBatchListResponse:
    result = await db.execute(
        select(ImportBatch).order_by(ImportBatch.created_at.desc()).limit(limit).offset(offset)
    )
    batches = result.scalars().all()

    total = (await db.execute(select(func.count()).select_from(ImportBatch))).scalar_one()

    return ImportBatchListResponse(
        data=[ImportBatchRead.model_validate(batch) for batch in batches],
        total=total,
    )


@router.get("/{import_id}", response_model=ImportBatchReadResponse)
async def get_import_batch(
    import_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> ImportBatchReadResponse:
    result = await db.execute(select(ImportBatch).where(ImportBatch.public_id == import_id))
    batch = result.scalar_one_or_none()
    if batch is None:
        raise NotFoundError(f"Import batch {import_id} not found")

    return ImportBatchReadResponse(data=ImportBatchRead.model_validate(batch))


@router.get("/{import_id}/errors", response_model=ImportRowErrorListResponse)
async def list_import_row_errors(
    import_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ImportRowErrorListResponse:
    batch = (
        await db.execute(select(ImportBatch).where(ImportBatch.public_id == import_id))
    ).scalar_one_or_none()
    if batch is None:
        raise NotFoundError(f"Import batch {import_id} not found")

    result = await db.execute(
        select(ImportRowError)
        .where(ImportRowError.import_batch_id == batch.id)
        .order_by(ImportRowError.row_number)
        .limit(limit)
        .offset(offset)
    )
    errors = result.scalars().all()

    total = (
        await db.execute(
            select(func.count())
            .select_from(ImportRowError)
            .where(ImportRowError.import_batch_id == batch.id)
        )
    ).scalar_one()

    return ImportRowErrorListResponse(
        data=[ImportRowErrorRead.model_validate(error) for error in errors],
        total=total,
    )
