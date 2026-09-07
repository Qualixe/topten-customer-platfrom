"""Mailchimp integration: syncing opted-in customers into a configured
Audience (List), and sending real campaigns to them (both a one-off send
from the Marketing page, and per-channel EMAIL campaigns created through
Quick Send — see app.tasks.sms_campaigns._send_email_campaign). This app
never creates an Audience itself via the API — Mailchimp's own mandatory
compliance fields for that (company, mailing address, permission reminder)
aren't collected here, so the admin creates the Audience directly in
Mailchimp and pastes its id in Settings; everything from there on
(members, segments, campaigns, sends) is real.
"""

from datetime import UTC, datetime
from uuid import UUID

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import get_or_create_credential_row
from app.common.exceptions import ValidationAppError
from app.common.mailchimp_client import (
    campaign_web_url,
    create_campaign,
    create_static_segment,
    get_reports_summary,
    send_campaign,
    send_test_email,
    set_campaign_content,
    upsert_member,
    verify_list,
)
from app.models.campaign import Campaign, CampaignChannel
from app.models.campaign_recipient import CampaignRecipient, CampaignRecipientStatus
from app.models.customer import Customer
from app.views.mailchimp_marketing import (
    EmailStats,
    SendCampaignReport,
    SyncItemResult,
    SyncReport,
)

MAX_TEST_EMAILS = 10

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


async def campaign_credentials_missing_fields(db: AsyncSession) -> list[str]:
    """Non-raising check for the required campaign-sending credential
    fields — used by pre-send validation (see
    app.services.campaign_send_validation) to report "not configured" as
    one of several possible blocking reasons, rather than aborting via an
    exception the way `_require_campaign_credentials` does for the actual
    send path."""
    row = await get_or_create_credential_row(db, MAILCHIMP_PROVIDER)
    return [field for field in _REQUIRED_CAMPAIGN_CREDENTIAL_FIELDS if not row.data.get(field)]


async def _require_campaign_credentials(db: AsyncSession) -> dict:
    missing = await campaign_credentials_missing_fields(db)
    if missing:
        raise ValidationAppError(
            "Save Mailchimp credentials (API key, Audience ID, From Name, and Reply-To email) "
            "in Settings before sending a campaign."
        )
    return (await get_or_create_credential_row(db, MAILCHIMP_PROVIDER)).data


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
    db: AsyncSession,
    *,
    customer_ids: list[UUID],
    subject: str,
    html_body: str,
) -> SendCampaignReport:
    """Sends a real Mailchimp campaign to exactly the given customers, in
    one step: upsert each as a list member (so Mailchimp has somewhere to
    send to), scope a fresh static segment to just their emails, create a
    campaign against that segment, set its content, and send — mirroring
    app.services.sendgrid_sync's now-removed campaign flow, but against
    Mailchimp's Segments API instead of a dedicated per-campaign List.
    Sending is irreversible, so every prior step must fully succeed before
    it's attempted.

    `html_body` is always the whole email, built by the caller (this app
    owns the layout/design entirely — see app.services.campaign_email) —
    Mailchimp is only ever the delivery provider here, never a template
    designer."""
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


async def send_test_campaign(
    db: AsyncSession,
    *,
    test_emails: list[str],
    subject: str,
    html_body: str,
) -> None:
    """For previewing a campaign's real rendered content before committing
    to a real send — creates a throwaway draft campaign (targeted at the
    whole Audience, never a real segment; see `create_campaign`'s
    docstring for why that's still safe), sets its content, and sends a
    Mailchimp "test send" to exactly `test_emails`. Reaches no real
    customer regardless of who's in the configured Audience. The draft
    campaign is left behind in Mailchimp afterward (visible, unsent) —
    this app doesn't track or clean it up, same as manually testing from
    Mailchimp's own UI would leave one too."""
    if not test_emails or len(test_emails) > MAX_TEST_EMAILS:
        raise ValidationAppError(f"Provide between 1 and {MAX_TEST_EMAILS} test email addresses.")

    data = await _require_campaign_credentials(db)
    list_result = await verify_list(api_key=data["api_key"], list_id=data["list_id"])
    if not list_result.success:
        raise ValidationAppError(f"Unable to reach Mailchimp: {list_result.message}")

    campaign_result = await create_campaign(
        api_key=data["api_key"],
        list_id=data["list_id"],
        segment_id=None,
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

    test_result = await send_test_email(
        api_key=data["api_key"],
        campaign_id=campaign_result.campaign_id,
        test_emails=test_emails,
    )
    if not test_result.success:
        raise ValidationAppError(f"Unable to send test email: {test_result.message}")


async def get_email_overview_stats(db: AsyncSession) -> EmailStats:
    """Account-wide EMAIL totals for the Reports page. `total_campaigns`/
    `sent`/`failed` come from this app's own `Campaign`/`CampaignRecipient`
    rows (channel=EMAIL) — the same source Campaign History reads, so the
    numbers agree with what's on that table. `opened` has no local
    equivalent (nothing in this app receives Mailchimp's open-tracking
    events back), so it's a best-effort live read of Mailchimp's own
    account-wide Reports API instead — not scoped to just this app's
    campaigns like the other three, since there's no local id to scope by
    (see `create_and_send_campaign`'s docstring: no Mailchimp campaign id
    is persisted). Never raises — a missing/invalid key just reports 0
    opens rather than breaking the whole stats section."""
    total_campaigns = (
        await db.execute(
            select(func.count())
            .select_from(Campaign)
            .where(Campaign.channel == CampaignChannel.EMAIL.value)
        )
    ).scalar_one()

    status_rows = (
        await db.execute(
            select(CampaignRecipient.status, func.count())
            .select_from(CampaignRecipient)
            .join(Campaign, Campaign.id == CampaignRecipient.campaign_id)
            .where(Campaign.channel == CampaignChannel.EMAIL.value)
            .group_by(CampaignRecipient.status)
        )
    ).all()
    status_counts = {status: count for status, count in status_rows}
    sent = status_counts.get(CampaignRecipientStatus.SENT.value, 0)
    failed = status_counts.get(CampaignRecipientStatus.FAILED.value, 0)

    opened = 0
    row = await get_or_create_credential_row(db, MAILCHIMP_PROVIDER)
    api_key = row.data.get("api_key")
    if api_key:
        try:
            reports_result = await get_reports_summary(api_key=api_key)
        except httpx.HTTPError:
            reports_result = None
        if reports_result is not None and reports_result.success:
            opened = reports_result.opens

    return EmailStats(total_campaigns=total_campaigns, sent=sent, opened=opened, failed=failed)
