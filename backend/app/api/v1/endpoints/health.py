from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db
from app.core.config import settings

router = APIRouter()


class HealthData(BaseModel):
    status: str
    service: str


class HealthResponse(BaseModel):
    """Shape: {"success": true, "data": {...}, "meta": {}} — the response
    envelope every /api/v1 endpoint follows, established here since this is
    the first endpoint the frontend connects to."""

    success: bool = True
    data: HealthData
    meta: dict[str, Any] = {}


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(data=HealthData(status="ok", service=settings.APP_NAME))


@router.get("/health/db")
async def health_check_db(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Verifies the API can reach PostgreSQL and execute a query."""
    result = await db.execute(text("SELECT version()"))
    version = result.scalar()
    return {"status": "ok", "db": version or "connected"}
