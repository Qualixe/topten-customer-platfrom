"""Automatic birthday SMS wish — settings CRUD plus the daily send job.

Reuses the exact same SMS-sending path a real campaign uses
(app.tasks.sms_campaigns._send_one_sms / render_message) rather than
duplicating gateway/personalization logic. Idempotency is a single
`last_birthday_wish_year` column on Customer (not a timestamp — see that
column's docstring) so a job that runs twice in one day, or a manually
triggered "send now" alongside the scheduled run, can never double-wish the
same customer in the same year.
"""

from datetime import UTC, date, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import get_or_create_credential_row
from app.common.sms_gateway_client import RequestStyle
from app.common.sms_gateway_client import send_sms as gateway_send_sms
from app.models.birthday_settings import BirthdaySettings
from app.models.customer import Customer
from app.services.sms_campaigns import SMS_GATEWAY_PROVIDER
from app.services.sms_campaigns_personalization import render_message
from app.views.birthday_settings import SendBirthdayWishesReport
from app.views.notifications import (
    DEFAULT_API_KEY_FIELD,
    DEFAULT_MESSAGE_FIELD,
    DEFAULT_NUMBER_FIELD,
    DEFAULT_SENDER_ID_FIELD,
)


async def get_or_create_birthday_settings(db: AsyncSession) -> BirthdaySettings:
    row = (await db.execute(select(BirthdaySettings))).scalars().first()
    if row is None:
        row = BirthdaySettings()
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


async def update_birthday_settings(
    db: AsyncSession,
    *,
    notify_days_before: int,
    auto_send_message: bool,
    message_template: str,
    auto_assign_gift: bool,
) -> BirthdaySettings:
    row = await get_or_create_birthday_settings(db)
    row.notify_days_before = notify_days_before
    row.auto_send_message = auto_send_message
    row.message_template = message_template
    row.auto_assign_gift = auto_assign_gift
    await db.commit()
    await db.refresh(row)
    return row


def _has_birthday_today(dob: date, today: date) -> bool:
    """Month/day match, year-independent — same Feb-29-on-a-non-leap-year
    fallback (treated as Feb 28) as _days_until_next_birthday in
    app.controllers.customers, so "today" here agrees with what the
    Birthdays page already shows as "Today"."""
    if dob.month == today.month and dob.day == today.day:
        return True
    return dob.month == 2 and dob.day == 29 and today.month == 2 and today.day == 28 and not _is_leap_year(today.year)


def _is_leap_year(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


async def _send_one_sms(credential_row, *, sender_id: str, phone: str, message: str) -> tuple[bool, str]:
    """Returns (success, failure_reason) — mirrors
    app.tasks.sms_campaigns._send_one_sms, kept separate since that one
    takes a Campaign/CampaignRecipient this job has neither of."""
    try:
        result = await gateway_send_sms(
            api_url=credential_row.data.get("api_url"),
            api_key=credential_row.data.get("api_key"),
            sender_id=sender_id,
            number=phone,
            message=message,
            request_style=RequestStyle(
                credential_row.data.get("request_style") or RequestStyle.GET_QUERY.value
            ),
            api_key_field=credential_row.data.get("api_key_field") or DEFAULT_API_KEY_FIELD,
            sender_id_field=credential_row.data.get("sender_id_field") or DEFAULT_SENDER_ID_FIELD,
            number_field=credential_row.data.get("number_field") or DEFAULT_NUMBER_FIELD,
            message_field=credential_row.data.get("message_field") or DEFAULT_MESSAGE_FIELD,
            request_id_field=credential_row.data.get("request_id_field"),
            success_field=credential_row.data.get("success_field"),
            success_value=credential_row.data.get("success_value"),
        )
    except httpx.HTTPError as exc:
        return False, str(exc)[:500]
    if result.success:
        return True, ""
    return False, f"HTTP {result.http_status}: {result.message}"[:500]


async def send_todays_birthday_wishes(
    db: AsyncSession, *, today: date | None = None
) -> SendBirthdayWishesReport:
    """Sends the configured wish to every customer with a phone number whose
    birthday is today, skipping anyone already wished this calendar year.
    A no-op (zero-everything report) if the feature is turned off or the SMS
    gateway isn't configured — never raises for either case, since the
    scheduled job has no one to surface an exception to."""
    today = today or datetime.now(UTC).date()
    settings_row = await get_or_create_birthday_settings(db)
    if not settings_row.auto_send_message:
        return SendBirthdayWishesReport(total=0, sent=0, failed=0, skipped_already_sent=0)

    credential_row = await get_or_create_credential_row(db, SMS_GATEWAY_PROVIDER)
    sender_id = credential_row.data.get("sender_id")
    if any(not credential_row.data.get(field) for field in ("api_url", "api_key")) or not sender_id:
        return SendBirthdayWishesReport(total=0, sent=0, failed=0, skipped_already_sent=0)

    candidates = (
        (await db.execute(select(Customer).where(Customer.date_of_birth.is_not(None))))
        .scalars()
        .all()
    )

    total = 0
    sent = 0
    failed = 0
    skipped_already_sent = 0

    for customer in candidates:
        if not _has_birthday_today(customer.date_of_birth, today):
            continue
        total += 1
        if customer.last_birthday_wish_year == today.year:
            skipped_already_sent += 1
            continue

        message = render_message(
            settings_row.message_template,
            customer_name=customer.name,
            phone=customer.phone,
            email=customer.email,
            date_of_birth=customer.date_of_birth,
        )
        success, _failure_reason = await _send_one_sms(
            credential_row, sender_id=sender_id, phone=customer.phone, message=message
        )
        if success:
            customer.last_birthday_wish_year = today.year
            sent += 1
        else:
            failed += 1
        await db.commit()

    return SendBirthdayWishesReport(
        total=total, sent=sent, failed=failed, skipped_already_sent=skipped_already_sent
    )
