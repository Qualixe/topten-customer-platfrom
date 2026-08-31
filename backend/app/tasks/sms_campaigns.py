"""Background resolution of a campaign's audience rule into a frozen
`CampaignRecipient` snapshot, and — once that's done — actually sending to
it.

Audience resolution runs exactly once per campaign, triggered right after
creation. It never re-runs for a campaign that already has a snapshot (see
the `recipients_resolved_at` guard below) — that's what guarantees a
campaign's recipient list stays fixed even if the audience rule would now
match different customers (e.g. after a later import).

Idempotency: the insert is a single `INSERT ... SELECT ... ON CONFLICT DO
NOTHING` keyed on the (campaign_id, customer_id) unique constraint, and
`total_recipients`/`estimated_cost` are always recomputed from a fresh COUNT
of `campaign_recipients` afterward rather than incremented — so a
redelivered/retried task (worker crash, `acks_late`) can safely re-run the
whole thing from scratch without ever double-inserting or double-counting.

Sending is only triggered automatically for campaigns whose `scheduled_at`
has already arrived by the time resolution finishes (i.e. "send now" — see
`resolve_campaign_audience_async`). A campaign scheduled for a future time
is resolved (so its recipient count/cost show correctly) but not sent —
there's no periodic scheduler in this codebase yet to poll for campaigns
whose time has since arrived.
"""

import asyncio
from datetime import UTC, datetime

import httpx
from sqlalchemy import and_, func, literal, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.common.credentials import get_or_create_credential_row
from app.common.email_client import send_email as mailchimp_send_email
from app.common.sms_gateway_client import RequestStyle
from app.common.sms_gateway_client import send_sms as gateway_send_sms
from app.core.celery_app import celery_app
from app.core.config import settings
from app.database import SessionLocal, engine
from app.models.campaign import Campaign, CampaignChannel, CampaignStatus
from app.models.campaign_landing_page import CampaignLandingPage
from app.models.campaign_recipient import CampaignRecipient, CampaignRecipientStatus
from app.models.customer import Customer
from app.services.sms_campaigns import (
    EMAIL_PROVIDER,
    SMS_GATEWAY_PROVIDER,
    get_or_create_campaign_profile_token,
    get_sms_rate_per_segment,
)
from app.services.sms_campaigns_audience import AudienceRule, build_condition
from app.services.sms_campaigns_personalization import render_message
from app.services.sms_campaigns_sms_utils import estimate_sms_cost
from app.views.notifications import (
    DEFAULT_API_KEY_FIELD,
    DEFAULT_MESSAGE_FIELD,
    DEFAULT_NUMBER_FIELD,
    DEFAULT_SENDER_ID_FIELD,
)


async def resolve_campaign_audience_async(
    campaign_id: int, session_factory: async_sessionmaker[AsyncSession] = SessionLocal
) -> None:
    """`session_factory` defaults to the production session maker; tests pass
    a test-database session maker instead, exercising the exact same
    resolve-and-freeze logic the Celery task runs in production."""
    async with session_factory() as session:
        campaign = await session.get(Campaign, campaign_id)
        if campaign is None:
            return
        if campaign.recipients_resolved_at is not None:
            # Already resolved — a stray retry/redelivery is a no-op.
            return

        rule = AudienceRule.from_stored(campaign.audience_rule_type, campaign.audience_rule_params)
        condition = build_condition(rule)
        # An EMAIL campaign can't reach a customer with no email on file —
        # excluded from the snapshot itself (not just skipped at send time)
        # so total_recipients/estimated_cost reflect who can actually be
        # reached, same as how the rule itself already excludes non-matches.
        if campaign.channel == CampaignChannel.EMAIL.value:
            condition = and_(condition, Customer.email.is_not(None))

        # public_id must be generated per matched row, not once for the
        # whole statement — an ORM Python-side default (uuid.uuid4) on an
        # INSERT...SELECT is evaluated exactly once and reused for every
        # row, which would violate the unique constraint the moment more
        # than one customer matches. gen_random_uuid() runs per row in SQL.
        # phone/email/date_of_birth are all copied regardless of channel —
        # cheap, and keeps the snapshot self-contained (personalization
        # tokens at send time read from here, never live from Customer).
        select_matching_customers = select(
            literal(campaign.id),
            Customer.id,
            Customer.phone,
            Customer.email,
            Customer.date_of_birth,
            Customer.name,
            literal(CampaignRecipientStatus.PENDING.value),
            func.gen_random_uuid(),
        ).where(condition)

        insert_stmt = pg_insert(CampaignRecipient).from_select(
            [
                "campaign_id",
                "customer_id",
                "phone",
                "email",
                "date_of_birth",
                "name",
                "status",
                "public_id",
            ],
            select_matching_customers,
        )
        insert_stmt = insert_stmt.on_conflict_do_nothing(
            index_elements=["campaign_id", "customer_id"]
        )
        await session.execute(insert_stmt)

        total_recipients = (
            await session.execute(
                select(func.count())
                .select_from(CampaignRecipient)
                .where(CampaignRecipient.campaign_id == campaign.id)
            )
        ).scalar_one()

        # No per-message cost model for EMAIL — estimated_cost stays 0.
        if campaign.channel == CampaignChannel.SMS.value:
            rate = await get_sms_rate_per_segment(session)
            campaign.estimated_cost = estimate_sms_cost(
                campaign.sms_segments, total_recipients, rate
            )

        campaign.total_recipients = total_recipients
        campaign.recipients_resolved_at = datetime.now(UTC)
        await session.commit()

        # "Send now" campaigns get `scheduled_at` set to the moment they
        # were saved, so by the time resolution finishes it's already in
        # the past — that's the signal to send immediately. A genuinely
        # future-scheduled campaign is left alone here; see module
        # docstring for why (no poller exists yet to pick it up later).
        if campaign.scheduled_at is not None and campaign.scheduled_at <= datetime.now(UTC):
            send_campaign_messages.delay(campaign.id)


async def _send_one_sms(
    credential_row, *, campaign: Campaign, recipient: CampaignRecipient, personalized_message: str
) -> tuple[bool, str]:
    """Returns (success, failure_reason) — failure_reason is only meaningful
    when success is False."""
    api_url = credential_row.data.get("api_url")
    api_key = credential_row.data.get("api_key")
    try:
        result = await gateway_send_sms(
            api_url=api_url,
            api_key=api_key,
            sender_id=campaign.sender_id,
            number=recipient.phone,
            message=personalized_message,
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


async def _send_one_email(
    credential_row,
    *,
    campaign: Campaign,
    recipient: CampaignRecipient,
    personalized_subject: str,
    personalized_body: str,
) -> tuple[bool, str]:
    if not recipient.email:
        # Shouldn't happen — audience resolution excludes no-email
        # customers for an EMAIL campaign — but guarded defensively rather
        # than attempting a send with no destination.
        return False, "No email address on file"

    result = await mailchimp_send_email(
        api_key=credential_row.data.get("api_key"),
        from_address=credential_row.data.get("from_address"),
        from_name=credential_row.data.get("from_name"),
        to_address=recipient.email,
        subject=personalized_subject,
        body=personalized_body,
    )
    return result.success, result.message[:500]


async def send_campaign_messages_async(
    campaign_id: int, session_factory: async_sessionmaker[AsyncSession] = SessionLocal
) -> None:
    """Sends a resolved campaign's still-PENDING recipients through its
    configured channel's provider (SMS Gateway or Mailchimp Transactional),
    one at a time (neither has a bulk-send API this client uses). Idempotent
    per recipient: only
    PENDING rows are picked up and each is moved to SENT/FAILED as soon as
    its own attempt resolves, so a retried/redelivered task never re-sends
    a recipient that's already SENT — it just continues wherever it left
    off.

    A recipient-level failure (bad number/address, provider rejects the
    message, ...) never stops the batch — every other PENDING recipient
    still gets tried. Only a missing/incomplete provider configuration is
    treated as fatal for the whole campaign, since no amount of retrying
    would help."""
    async with session_factory() as session:
        campaign = await session.get(Campaign, campaign_id)
        if campaign is None or campaign.recipients_resolved_at is None:
            return
        if campaign.status not in (CampaignStatus.SCHEDULED.value, CampaignStatus.PROCESSING.value):
            # Already COMPLETED/FAILED/CANCELLED — a stray retry is a no-op.
            return

        is_email = campaign.channel == CampaignChannel.EMAIL.value
        provider = EMAIL_PROVIDER if is_email else SMS_GATEWAY_PROVIDER
        credential_row = await get_or_create_credential_row(session, provider)
        required_fields = ("api_key", "from_address") if is_email else ("api_url", "api_key")
        if any(not credential_row.data.get(field) for field in required_fields):
            campaign.status = CampaignStatus.FAILED.value
            await session.commit()
            return

        campaign.status = CampaignStatus.PROCESSING.value
        await session.commit()

        # Only a published landing page gets a link in the message — a
        # draft page isn't reachable publicly (see the public landing-page
        # endpoint), so there'd be nothing for the customer to open.
        landing_page = (
            await session.execute(
                select(CampaignLandingPage).where(
                    CampaignLandingPage.campaign_id == campaign.id,
                    CampaignLandingPage.published.is_(True),
                )
            )
        ).scalar_one_or_none()

        # FOR UPDATE SKIP LOCKED: if this task is somehow running twice at
        # once for the same campaign (overlapping retry, accidental double
        # trigger), each invocation locks the PENDING rows it's about to
        # send and the other skips them instead of blocking — so the same
        # recipient never gets sent to twice. Rows already sent by the
        # other invocation are excluded anyway once its per-recipient
        # commits land.
        pending = (
            await session.execute(
                select(CampaignRecipient)
                .where(
                    CampaignRecipient.campaign_id == campaign.id,
                    CampaignRecipient.status == CampaignRecipientStatus.PENDING.value,
                )
                .order_by(CampaignRecipient.id)
                .with_for_update(skip_locked=True)
            )
        ).scalars().all()

        for recipient in pending:
            form_link = None
            if landing_page is not None:
                token = await get_or_create_campaign_profile_token(
                    session, customer_id=recipient.customer_id, campaign_id=campaign.id
                )
                form_link = (
                    f"{settings.FRONTEND_BASE_URL}/campaign/{landing_page.slug}"
                    f"?token={token.token}"
                )

            personalized_message = render_message(
                campaign.message,
                customer_name=recipient.name,
                form_link=form_link,
                phone=recipient.phone,
                email=recipient.email,
                date_of_birth=recipient.date_of_birth,
            )

            if is_email:
                personalized_subject = render_message(
                    campaign.subject or "",
                    customer_name=recipient.name,
                    form_link=form_link,
                    phone=recipient.phone,
                    email=recipient.email,
                    date_of_birth=recipient.date_of_birth,
                )
                success, failure_reason = await _send_one_email(
                    credential_row,
                    campaign=campaign,
                    recipient=recipient,
                    personalized_subject=personalized_subject,
                    personalized_body=personalized_message,
                )
            else:
                success, failure_reason = await _send_one_sms(
                    credential_row,
                    campaign=campaign,
                    recipient=recipient,
                    personalized_message=personalized_message,
                )

            if success:
                recipient.status = CampaignRecipientStatus.SENT.value
                recipient.sent_at = datetime.now(UTC)
            else:
                recipient.status = CampaignRecipientStatus.FAILED.value
                recipient.failed_at = datetime.now(UTC)
                recipient.failure_reason = failure_reason
            await session.commit()

        campaign.status = CampaignStatus.COMPLETED.value
        await session.commit()


async def _run_resolve_and_dispose(campaign_id: int) -> None:
    # See app.tasks.imports for why the engine must be disposed at
    # the end of every task: each Celery task invocation gets its own fresh
    # event loop via asyncio.run(), but the async engine's connection pool
    # is created once at import time and would otherwise stay bound to
    # whichever loop first used it.
    try:
        await resolve_campaign_audience_async(campaign_id)
    finally:
        await engine.dispose()


@celery_app.task(
    name="sms_campaigns.resolve_campaign_audience",
    bind=True,
    acks_late=True,
    max_retries=3,
    default_retry_delay=30,
)
def resolve_campaign_audience(self, campaign_id: int) -> None:
    asyncio.run(_run_resolve_and_dispose(campaign_id))


async def _run_send_and_dispose(campaign_id: int) -> None:
    try:
        await send_campaign_messages_async(campaign_id)
    finally:
        await engine.dispose()


@celery_app.task(
    name="sms_campaigns.send_campaign_messages",
    bind=True,
    acks_late=True,
    max_retries=3,
    default_retry_delay=30,
)
def send_campaign_messages(self, campaign_id: int) -> None:
    asyncio.run(_run_send_and_dispose(campaign_id))
