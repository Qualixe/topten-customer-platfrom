from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db
from app.services.notification_log import get_notification_stats, list_notifications
from app.views.notification_log import (
    NotificationsListResponse,
    NotificationsMeta,
    NotificationStatsResponse,
    NotificationStatus,
    NotificationType,
)

# Mounted at the same /notifications prefix as app.controllers.notifications
# (the SMS gateway credentials sub-resource) — paths here (`""`, `/stats`)
# don't collide with that router's `/sms-gateway/*` paths. Deliberately no
# extra permission dependency beyond being logged in: the frontend's
# Notifications nav item has no permission gate, so any authenticated user
# (including Staff) can see what's actually been sent.
router = APIRouter()


@router.get("", response_model=NotificationsListResponse)
async def list_notifications_endpoint(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    status: NotificationStatus | None = Query(None),
    notification_type: NotificationType | None = Query(None, alias="type"),
    search: str | None = Query(None),
) -> NotificationsListResponse:
    records, total = await list_notifications(
        db,
        status=status,
        type=notification_type,
        search=search,
        page=page,
        page_size=page_size,
    )
    total_pages = max(1, -(-total // page_size))
    meta = NotificationsMeta(page=page, page_size=page_size, total=total, total_pages=total_pages)
    return NotificationsListResponse(data=records, meta=meta)


@router.get("/stats", response_model=NotificationStatsResponse)
async def get_notification_stats_endpoint(
    db: AsyncSession = Depends(get_db),
) -> NotificationStatsResponse:
    stats = await get_notification_stats(db)
    return NotificationStatsResponse(data=stats)
