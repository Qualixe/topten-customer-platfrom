from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db, require_permission
from app.models.birthday_settings import BirthdaySettings
from app.services.birthday_wishes import get_or_create_birthday_settings, update_birthday_settings
from app.views.birthday_settings import (
    BirthdaySettingsData,
    BirthdaySettingsResponse,
    BirthdaySettingsUpdate,
)

router = APIRouter(dependencies=[Depends(require_permission("settings.manage"))])


def _to_data(row: BirthdaySettings) -> BirthdaySettingsData:
    return BirthdaySettingsData(
        notify_days_before=row.notify_days_before,
        auto_send_message=row.auto_send_message,
        message_template=row.message_template,
        auto_send_email=row.auto_send_email,
        email_subject=row.email_subject,
        email_message_template=row.email_message_template,
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
        auto_send_email=payload.auto_send_email,
        email_subject=payload.email_subject,
        email_message_template=payload.email_message_template,
        auto_assign_gift=payload.auto_assign_gift,
    )
    return BirthdaySettingsResponse(data=_to_data(row))
