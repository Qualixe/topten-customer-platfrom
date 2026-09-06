from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db, require_permission
from app.models.birthday_settings import BirthdaySettings
from app.services.birthday_wishes import (
    get_or_create_birthday_settings,
    send_todays_birthday_wishes,
    update_birthday_settings,
)
from app.views.birthday_settings import (
    BirthdaySettingsData,
    BirthdaySettingsResponse,
    BirthdaySettingsUpdate,
    SendBirthdayWishesResponse,
)

router = APIRouter(dependencies=[Depends(require_permission("settings.manage"))])


def _to_data(row: BirthdaySettings) -> BirthdaySettingsData:
    return BirthdaySettingsData(
        notify_days_before=row.notify_days_before,
        auto_send_message=row.auto_send_message,
        message_template=row.message_template,
        auto_assign_gift=row.auto_assign_gift,
    )


@router.get("", response_model=BirthdaySettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db)) -> BirthdaySettingsResponse:
    row = await get_or_create_birthday_settings(db)
    return BirthdaySettingsResponse(data=_to_data(row))


@router.put("", response_model=BirthdaySettingsResponse)
async def update_settings(
    payload: BirthdaySettingsUpdate, db: AsyncSession = Depends(get_db)
) -> BirthdaySettingsResponse:
    row = await update_birthday_settings(
        db,
        notify_days_before=payload.notify_days_before,
        auto_send_message=payload.auto_send_message,
        message_template=payload.message_template,
        auto_assign_gift=payload.auto_assign_gift,
    )
    return BirthdaySettingsResponse(data=_to_data(row))


@router.post("/send-now", response_model=SendBirthdayWishesResponse)
async def send_now(db: AsyncSession = Depends(get_db)) -> SendBirthdayWishesResponse:
    """Runs the exact same job the daily schedule runs, on demand — lets an
    admin verify the feature works (and catch up any customers missed) any
    time, not only at the scheduled hour. Still a no-op unless
    auto_send_message is on and the SMS gateway is configured; see
    send_todays_birthday_wishes."""
    report = await send_todays_birthday_wishes(db)
    return SendBirthdayWishesResponse(data=report)
