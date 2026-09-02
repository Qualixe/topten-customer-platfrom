"""Syncs opted-in customers into a SendGrid Marketing List and drives
SendGrid's own Single Send engine to send bulk promotional email — the
SendGrid-backed replacement for the earlier Mailchimp Transactional-based
Email campaign channel (see app.tasks.sms_campaigns's module docstring).
Two distinct steps, matching how SendGrid itself models this:

1. Sync — upsert selected, marketing_opt_in customers into the configured
   List (`sync_customers`). Never touches anyone who hasn't opted in.
2. Campaign — build a dedicated per-campaign List from already-synced
   customers (SendGrid has no lightweight ad-hoc "static segment" the way
   Mailchimp does, so a fresh List stands in for one), create a Single
   Send against it, and (as a separate, explicit step) send it
   (`create_campaign_draft` / `send_campaign_draft`) — a real send to a
   real audience is irreversible, so creation and sending are deliberately
   two calls, not one.
"""

from datetime import UTC, datetime
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import get_or_create_credential_row, merge_credential_data
from app.common.exceptions import NotFoundError, ValidationAppError
from app.common.sendgrid_client import (
    create_single_send,
    find_or_create_list,
    find_or_create_suppression_group,
    find_verified_sender,
    upsert_contact,
)
from app.common.sendgrid_client import (
    schedule_single_send_now as sendgrid_schedule_now,
)
from app.models.customer import Customer
from app.models.sendgrid_campaign import SendGridCampaign, SendGridCampaignStatus
from app.views.sendgrid_marketing import SyncItemResult, SyncReport

SENDGRID_PROVIDER = "sendgrid_marketing"

_REQUIRED_CREDENTIAL_FIELDS = (
    "api_key",
    "list_name",
    "from_name",
    "from_email",
    "reply_to_email",
)


async def _require_credentials(db: AsyncSession) -> dict:
    row = await get_or_create_credential_row(db, SENDGRID_PROVIDER)
    missing = [field for field in _REQUIRED_CREDENTIAL_FIELDS if not row.data.get(field)]
    if missing:
        raise ValidationAppError(
            "Save SendGrid Marketing credentials (API key, list name, from name, from email, "
            "and reply-to email) in Settings before syncing."
        )
    return row.data


async def _ensure_list(db: AsyncSession, data: dict) -> str:
    result = await find_or_create_list(api_key=data["api_key"], name=data["list_name"])
    if not result.success or not result.list_id:
        raise ValidationAppError(f"Unable to reach SendGrid: {result.message}")
    # Informational cache only — the list is always (re-)resolved by name
    # above, so a later change to `list_name` just finds/creates a
    # different list rather than silently syncing to a stale one.
    if data.get("list_id") != result.list_id:
        await merge_credential_data(db, SENDGRID_PROVIDER, {"list_id": result.list_id})
    return result.list_id


async def _ensure_sender(db: AsyncSession, data: dict) -> int:
    """Sender verification is an external SendGrid-side setup step — this
    app never creates a Sender Identity via the API (see
    find_verified_sender's docstring). If nothing in the account's Sender
    Identities matches the configured `from_email` yet, that's a real,
    actionable state (not a bug): the admin needs to verify that sender or
    authenticate its domain in SendGrid first."""
    result = await find_verified_sender(api_key=data["api_key"], from_email=data["from_email"])
    if not result.success:
        raise ValidationAppError(f"Unable to reach SendGrid: {result.message}")
    if result.sender_id is None:
        raise ValidationAppError(
            f"No verified sender found for {data['from_email']} in SendGrid. Verify this "
            "sender or authenticate its domain in SendGrid before sending campaigns."
        )
    if data.get("sender_id") != result.sender_id:
        await merge_credential_data(db, SENDGRID_PROVIDER, {"sender_id": result.sender_id})
    return result.sender_id


async def check_sender_verified(data: dict) -> bool:
    """Non-fatal status check for display only (see the credentials GET
    endpoint) — never raises. `api_key`/`from_email` not yet saved, a
    SendGrid API error, or no matching Sender Identity all read the same
    way here: not (yet) verified. The real, error-raising check a send
    actually depends on is `_ensure_sender` above."""
    if not data.get("api_key") or not data.get("from_email"):
        return False
    try:
        result = await find_verified_sender(api_key=data["api_key"], from_email=data["from_email"])
    except httpx.HTTPError:
        return False
    return bool(result.success and result.verified)


async def _ensure_suppression_group(db: AsyncSession, data: dict) -> int:
    result = await find_or_create_suppression_group(
        api_key=data["api_key"],
        name=f"{data['list_name']} Unsubscribes",
        description="Unsubscribe group for marketing campaigns sent from this app.",
    )
    if not result.success or result.group_id is None:
        raise ValidationAppError(f"Unable to reach SendGrid: {result.message}")
    if data.get("suppression_group_id") != result.group_id:
        await merge_credential_data(
            db, SENDGRID_PROVIDER, {"suppression_group_id": result.group_id}
        )
    return result.group_id


async def sync_customers(db: AsyncSession, *, customer_ids: list[UUID]) -> SyncReport:
    data = await _require_credentials(db)
    list_id = await _ensure_list(db, data)

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
        result = await upsert_contact(
            api_key=data["api_key"],
            list_id=list_id,
            email=customer.email,  # type: ignore[arg-type]  # filtered non-null above
            first_name=customer.name,
            phone=customer.phone,
        )
        if result.success:
            customer.marketing_synced_at = datetime.now(UTC)
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
    # email on file) is reported too, rather than silently dropped — the
    # caller asked for it and deserves to know why it didn't happen.
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


async def create_campaign_draft(
    db: AsyncSession,
    *,
    customer_ids: list[UUID],
    subject: str,
    html_body: str,
    from_name: str | None,
    from_email: str | None,
) -> SendGridCampaign:
    data = await _require_credentials(db)
    sender_id = await _ensure_sender(db, data)
    suppression_group_id = await _ensure_suppression_group(db, data)

    synced = (
        (
            await db.execute(
                select(Customer).where(
                    Customer.public_id.in_(customer_ids),
                    Customer.marketing_opt_in.is_(True),
                    Customer.email.is_not(None),
                    Customer.marketing_synced_at.is_not(None),
                )
            )
        )
        .scalars()
        .all()
    )
    if not synced:
        raise ValidationAppError(
            "None of the selected customers are synced and opted in yet — sync them to "
            "SendGrid first."
        )

    campaign_list_name = f"campaign-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
    list_result = await find_or_create_list(api_key=data["api_key"], name=campaign_list_name)
    if not list_result.success or not list_result.list_id:
        raise ValidationAppError(f"Unable to create SendGrid list: {list_result.message}")

    for customer in synced:
        upsert_result = await upsert_contact(
            api_key=data["api_key"],
            list_id=list_result.list_id,
            email=customer.email,  # type: ignore[arg-type]
            first_name=customer.name,
            phone=customer.phone,
        )
        if not upsert_result.success:
            raise ValidationAppError(
                f"Unable to add {customer.email} to the campaign list: {upsert_result.message}"
            )

    resolved_from_name = from_name or data["from_name"]
    resolved_from_email = from_email or data["from_email"]

    campaign_result = await create_single_send(
        api_key=data["api_key"],
        list_id=list_result.list_id,
        sender_id=sender_id,
        suppression_group_id=suppression_group_id,
        name=campaign_list_name,
        subject=subject,
        html=html_body,
    )
    if not campaign_result.success or not campaign_result.campaign_id:
        raise ValidationAppError(f"Unable to create SendGrid campaign: {campaign_result.message}")

    row = SendGridCampaign(
        sendgrid_campaign_id=campaign_result.campaign_id,
        sendgrid_list_id=list_result.list_id,
        subject=subject,
        from_name=resolved_from_name,
        from_email=resolved_from_email,
        html_body=html_body,
        recipient_count=len(synced),
        status=SendGridCampaignStatus.DRAFT.value,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def get_campaign_by_public_id(db: AsyncSession, public_id: UUID) -> SendGridCampaign:
    row = (
        await db.execute(select(SendGridCampaign).where(SendGridCampaign.public_id == public_id))
    ).scalar_one_or_none()
    if row is None:
        raise NotFoundError("SendGrid campaign not found")
    return row


async def send_campaign_draft(db: AsyncSession, campaign: SendGridCampaign) -> SendGridCampaign:
    if campaign.status != SendGridCampaignStatus.DRAFT.value:
        raise ValidationAppError(f"Campaign is already {campaign.status.lower()}, not a draft.")

    data = await _require_credentials(db)
    result = await sendgrid_schedule_now(
        api_key=data["api_key"], campaign_id=campaign.sendgrid_campaign_id
    )
    if result.success:
        campaign.status = SendGridCampaignStatus.SENT.value
        campaign.sent_at = datetime.now(UTC)
    else:
        campaign.status = SendGridCampaignStatus.FAILED.value
        campaign.error_message = result.message[:500]
    await db.commit()
    await db.refresh(campaign)
    return campaign


async def list_campaigns(db: AsyncSession) -> list[SendGridCampaign]:
    rows = (
        await db.execute(select(SendGridCampaign).order_by(SendGridCampaign.created_at.desc()))
    ).scalars().all()
    return list(rows)
