"""Syncs opted-in customers into a Mailchimp Audience (List) — the
Mailchimp-backed counterpart to app.services.sendgrid_sync, running
alongside it rather than replacing it (an admin can configure and sync to
either or both). Deliberately sync-only: unlike SendGrid, this app doesn't
build a campaign-sending flow on top of Mailchimp — Mailchimp's own
mandatory compliance fields for creating an Audience via the API (company,
mailing address, permission reminder) aren't collected here, so the admin
creates the Audience directly in Mailchimp and pastes its id in Settings.
"""

from datetime import UTC, datetime
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import get_or_create_credential_row
from app.common.exceptions import ValidationAppError
from app.common.mailchimp_client import (
    campaign_web_url,
    create_campaign,
    create_static_segment,
    send_campaign,
    set_campaign_content,
    upsert_member,
    verify_list,
)
from app.models.customer import Customer
from app.views.mailchimp_marketing import SendCampaignReport, SyncItemResult, SyncReport

MAILCHIMP_PROVIDER = "mailchimp_marketing"

_REQUIRED_CREDENTIAL_FIELDS = ("api_key", "list_id")
_REQUIRED_CAMPAIGN_CREDENTIAL_FIELDS = ("api_key", "list_id", "from_name", "reply_to_email")


async def _require_credentials(db: AsyncSession) -> dict:
    row = await get_or_create_credential_row(db, MAILCHIMP_PROVIDER)
    missing = [field for field in _REQUIRED_CREDENTIAL_FIELDS if not row.data.get(field)]
    if missing:
        raise ValidationAppError(
            "Save Mailchimp credentials (API key and Audience ID) in Settings before syncing."
        )
    return row.data


async def _require_campaign_credentials(db: AsyncSession) -> dict:
    row = await get_or_create_credential_row(db, MAILCHIMP_PROVIDER)
    missing = [
        field for field in _REQUIRED_CAMPAIGN_CREDENTIAL_FIELDS if not row.data.get(field)
    ]
    if missing:
        raise ValidationAppError(
            "Save Mailchimp credentials (API key, Audience ID, From Name, and Reply-To email) "
            "in Settings before sending a campaign."
        )
    return row.data


async def check_list_status(data: dict) -> tuple[bool, str | None]:
    """Non-fatal status check for display only (see the credentials GET
    endpoint) — never raises. Returns (is_valid, list_name)."""
    if not data.get("api_key") or not data.get("list_id"):
        return False, None
    try:
        result = await verify_list(api_key=data["api_key"], list_id=data["list_id"])
    except httpx.HTTPError:
        return False, None
    return result.success, result.list_name


async def sync_customers(db: AsyncSession, *, customer_ids: list[UUID]) -> SyncReport:
    data = await _require_credentials(db)
    list_result = await verify_list(api_key=data["api_key"], list_id=data["list_id"])
    if not list_result.success:
        raise ValidationAppError(f"Unable to reach Mailchimp: {list_result.message}")

    eligible = (
        (
            await db.execute(
                select(Customer).where(
                    Customer.public_id.in_(customer_ids),
                    Customer.marketing_opt_in.is_(True),
                    Customer.email.is_not(None),
                )
            )
        )
        .scalars()
        .all()
    )

    items: list[SyncItemResult] = []
    for customer in eligible:
        result = await upsert_member(
            api_key=data["api_key"],
            list_id=data["list_id"],
            email=customer.email,  # type: ignore[arg-type]  # filtered non-null above
            first_name=customer.name,
            phone=customer.phone,
        )
        if result.success:
            customer.mailchimp_synced_at = datetime.now(UTC)
        items.append(
            SyncItemResult(
                customer_id=customer.public_id,
                email=customer.email or "",
                success=result.success,
                message=result.message,
            )
        )
    await db.commit()

    # Anything requested but not in `eligible` (no marketing_opt_in, or no
    # email on file) is reported too, rather than silently dropped.
    reached_ids = {customer.public_id for customer in eligible}
    for skipped_id in set(customer_ids) - reached_ids:
        items.append(
            SyncItemResult(
                customer_id=skipped_id,
                email="",
                success=False,
                message="Not eligible — needs marketing opt-in and a saved email address.",
            )
        )

    failed = sum(1 for item in items if not item.success)
    return SyncReport(total=len(items), synced=len(items) - failed, failed=failed, items=items)


async def create_and_send_campaign(
    db: AsyncSession, *, customer_ids: list[UUID], subject: str, html_body: str
) -> SendCampaignReport:
    """Sends a real Mailchimp campaign to exactly the given customers, in
    one step: upsert each as a list member (so Mailchimp has somewhere to
    send to), scope a fresh static segment to just their emails, create a
    campaign against that segment, set its content, and send — mirroring
    app.services.sendgrid_sync's now-removed campaign flow, but against
    Mailchimp's Segments API instead of a dedicated per-campaign List.
    Sending is irreversible, so every prior step must fully succeed before
    it's attempted."""
    data = await _require_campaign_credentials(db)
    list_result = await verify_list(api_key=data["api_key"], list_id=data["list_id"])
    if not list_result.success:
        raise ValidationAppError(f"Unable to reach Mailchimp: {list_result.message}")

    eligible = (
        (
            await db.execute(
                select(Customer).where(
                    Customer.public_id.in_(customer_ids),
                    Customer.marketing_opt_in.is_(True),
                    Customer.email.is_not(None),
                )
            )
        )
        .scalars()
        .all()
    )

    items: list[SyncItemResult] = []
    recipient_emails: list[str] = []
    for customer in eligible:
        result = await upsert_member(
            api_key=data["api_key"],
            list_id=data["list_id"],
            email=customer.email,  # type: ignore[arg-type]  # filtered non-null above
            first_name=customer.name,
            phone=customer.phone,
        )
        if result.success:
            customer.mailchimp_synced_at = datetime.now(UTC)
            recipient_emails.append(customer.email)  # type: ignore[arg-type]
        items.append(
            SyncItemResult(
                customer_id=customer.public_id,
                email=customer.email or "",
                success=result.success,
                message=(
                    result.message
                    if result.success
                    else f"Not added to Mailchimp: {result.message}"
                ),
            )
        )
    await db.commit()

    reached_ids = {customer.public_id for customer in eligible}
    for skipped_id in set(customer_ids) - reached_ids:
        items.append(
            SyncItemResult(
                customer_id=skipped_id,
                email="",
                success=False,
                message="Not eligible — needs marketing opt-in and a saved email address.",
            )
        )

    if not recipient_emails:
        return SendCampaignReport(total=len(items), sent=0, failed=len(items), items=items)

    segment_name = f"campaign-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
    segment_result = await create_static_segment(
        api_key=data["api_key"],
        list_id=data["list_id"],
        name=segment_name,
        emails=recipient_emails,
    )
    if not segment_result.success or segment_result.segment_id is None:
        raise ValidationAppError(f"Unable to create Mailchimp segment: {segment_result.message}")

    campaign_result = await create_campaign(
        api_key=data["api_key"],
        list_id=data["list_id"],
        segment_id=segment_result.segment_id,
        subject=subject,
        from_name=data["from_name"],
        reply_to=data["reply_to_email"],
    )
    if not campaign_result.success or not campaign_result.campaign_id:
        raise ValidationAppError(f"Unable to create Mailchimp campaign: {campaign_result.message}")

    content_result = await set_campaign_content(
        api_key=data["api_key"], campaign_id=campaign_result.campaign_id, html=html_body
    )
    if not content_result.success:
        raise ValidationAppError(
            f"Unable to set Mailchimp campaign content: {content_result.message}"
        )

    send_result = await send_campaign(
        api_key=data["api_key"], campaign_id=campaign_result.campaign_id
    )
    if not send_result.success:
        raise ValidationAppError(f"Unable to send Mailchimp campaign: {send_result.message}")

    campaign_url = (
        campaign_web_url(api_key=data["api_key"], web_id=campaign_result.web_id)
        if campaign_result.web_id is not None
        else None
    )
    failed = len(items) - len(recipient_emails)
    return SendCampaignReport(
        total=len(items),
        sent=len(recipient_emails),
        failed=failed,
        items=items,
        campaign_url=campaign_url,
    )
