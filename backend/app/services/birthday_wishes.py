"""Automatic birthday wish — settings CRUD plus the send job, for both SMS
and email. Gated by a single `enabled` flag and a `channel` selector
("SMS", "EMAIL", or "BOTH"); the hour-of-day gate (`send_hour`, UTC) lives
in the Celery task wrapper (app.tasks.birthday_wishes), not here, so this
function stays callable at any wall-clock time for direct calls and tests.

SMS reuses the exact same send path a real campaign uses
(app.tasks.sms_campaigns._send_one_sms / render_message) rather than
duplicating gateway/personalization logic. Email reuses
app.services.mailchimp_sync.create_and_send_campaign — the same real
Mailchimp send used by the Marketing page and Quick Send's EMAIL channel —
called once per birthday customer so each gets their own personalized
subject/body (Mailchimp campaigns have no per-recipient personalization
this app uses).

The two channels have separate idempotency columns on Customer
(`last_birthday_wish_year` for SMS, `last_birthday_email_year` for email)
— not timestamps, see those columns' docstring — so a job that runs twice
in one day, or a customer who has only one channel selected, can never
double-wish nor get skipped incorrectly.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import get_or_create_credential_row
from app.common.exceptions import ValidationAppError
from app.common.sms_gateway_client import RequestStyle
from app.common.sms_gateway_client import send_sms as gateway_send_sms
from app.models.birthday_settings import BirthdaySettings
from app.models.customer import Customer
from app.services.mailchimp_sync import create_and_send_campaign
from app.services.sms_campaigns import SMS_GATEWAY_PROVIDER
from app.services.sms_campaigns_personalization import render_message
from app.views.notifications import (
    DEFAULT_API_KEY_FIELD,
    DEFAULT_MESSAGE_FIELD,
    DEFAULT_NUMBER_FIELD,
    DEFAULT_SENDER_ID_FIELD,
)


@dataclass(frozen=True, slots=True)
class SendBirthdayWishesReport:
    """Result of one run of the daily auto-wish job, split per channel —
    used directly by tests; nothing else consumes it (the job itself is
    fire-and-forget, see app.tasks.birthday_wishes)."""

    total: int
    sent: int
    failed: int
    skipped_already_sent: int
    email_total: int = 0
    email_sent: int = 0
    email_failed: int = 0
    email_skipped_already_sent: int = 0


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
    enabled: bool,
    channel: str,
    send_hour: int,
    company_name: str,
    message_template: str,
    email_subject: str,
    email_message_template: str,
    auto_assign_gift: bool,
) -> BirthdaySettings:
    row = await get_or_create_birthday_settings(db)
    row.notify_days_before = notify_days_before
    row.enabled = enabled
    row.channel = channel
    row.send_hour = send_hour
    row.company_name = company_name
    row.message_template = message_template
    row.email_subject = email_subject
    row.email_message_template = email_message_template
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


def _render(template: str, customer: Customer, company_name: str) -> str:
    return render_message(
        template,
        customer_name=customer.name,
        phone=customer.phone,
        email=customer.email,
        date_of_birth=customer.date_of_birth,
        city=customer.city,
        company_name=company_name or None,
    )


async def send_todays_birthday_wishes(
    db: AsyncSession, *, today: date | None = None
) -> SendBirthdayWishesReport:
    """Sends the configured wish(es) to every customer whose birthday is
    today, skipping (per channel) anyone already wished that channel this
    calendar year. A no-op (zero-everything report, `last_run_at` left
    untouched) if automation is disabled — never raises, since the
    scheduled job has no one to surface an exception to; a single
    customer's send failing on either channel doesn't stop the rest."""
    today = today or datetime.now(UTC).date()
    settings_row = await get_or_create_birthday_settings(db)

    if not settings_row.enabled:
        return SendBirthdayWishesReport(total=0, sent=0, failed=0, skipped_already_sent=0)

    settings_row.last_run_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(settings_row)

    send_sms = settings_row.channel in ("SMS", "BOTH")
    send_email = settings_row.channel in ("EMAIL", "BOTH")

    all_customers = (
        (await db.execute(select(Customer).where(Customer.date_of_birth.is_not(None))))
        .scalars()
        .all()
    )
    todays_customers = [c for c in all_customers if _has_birthday_today(c.date_of_birth, today)]

    total = sent = failed = skipped_already_sent = 0
    if send_sms:
        credential_row = await get_or_create_credential_row(db, SMS_GATEWAY_PROVIDER)
        sender_id = credential_row.data.get("sender_id")
        gateway_ready = (
            not any(not credential_row.data.get(field) for field in ("api_url", "api_key"))
            and sender_id
        )
        if gateway_ready:
            for customer in todays_customers:
                total += 1
                if customer.last_birthday_wish_year == today.year:
                    skipped_already_sent += 1
                    continue
                message = _render(settings_row.message_template, customer, settings_row.company_name)
                success, _failure_reason = await _send_one_sms(
                    credential_row, sender_id=sender_id, phone=customer.phone, message=message
                )
                if success:
                    customer.last_birthday_wish_year = today.year
                    sent += 1
                else:
                    failed += 1
                await db.commit()

    email_total = email_sent = email_failed = email_skipped_already_sent = 0
    if send_email:
        for customer in todays_customers:
            if not customer.email:
                continue
            email_total += 1
            if customer.last_birthday_email_year == today.year:
                email_skipped_already_sent += 1
                continue
            subject = _render(settings_row.email_subject, customer, settings_row.company_name)
            html_body = _render(settings_row.email_message_template, customer, settings_row.company_name)
            try:
                # One customer per call — a customer not opted into
                # marketing simply comes back with sent=0 below (never
                # raises for that), respecting the same opt-in requirement
                # every other Mailchimp send in this app honors.
                campaign_report = await create_and_send_campaign(
                    db, customer_ids=[customer.public_id], subject=subject, html_body=html_body
                )
            except ValidationAppError:
                email_failed += 1
                continue
            if campaign_report.sent >= 1:
                customer.last_birthday_email_year = today.year
                email_sent += 1
            else:
                email_failed += 1
            await db.commit()

    return SendBirthdayWishesReport(
        total=total,
        sent=sent,
        failed=failed,
        skipped_already_sent=skipped_already_sent,
        email_total=email_total,
        email_sent=email_sent,
        email_failed=email_failed,
        email_skipped_already_sent=email_skipped_already_sent,
    )
