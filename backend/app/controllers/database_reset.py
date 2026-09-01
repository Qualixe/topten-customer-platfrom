from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db, require_permission
from app.common.rate_limit import rate_limit
from app.services.database_reset import (
    DatabaseBackupError,
    backup_database,
    reset_business_data,
)
from app.views.database_reset import (
    DatabaseResetRequest,
    DatabaseResetResponse,
    DatabaseResetResult,
)

router = APIRouter()


@router.post("/reset", response_model=DatabaseResetResponse)
async def reset_database(
    payload: DatabaseResetRequest,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("database.reset")),
    __: object = Depends(rate_limit("database-reset", max_requests=3, window_seconds=3600)),
) -> DatabaseResetResponse:
    """Wipes all business/customer data (see app.services.database_reset
    for exactly what's kept vs cleared). `payload.confirm` must already be
    the exact required phrase — enforced by DatabaseResetRequest's own
    validator — so this endpoint only runs when that's already true.

    Always backs up first: if pg_dump fails, the reset is aborted before
    anything is touched, rather than deleting data with no recovery path."""
    try:
        backup_path = await backup_database()
    except DatabaseBackupError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Backup failed, reset aborted — no data was touched. {exc}",
        ) from exc

    await reset_business_data(db)

    return DatabaseResetResponse(
        data=DatabaseResetResult(backup_file=backup_path.name, reset_at=datetime.now(UTC))
    )
