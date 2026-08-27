"""SMS campaign service: audience resolution, rate lookup, campaign CRUD
orchestration, and recipient/stat queries.

Every audience count/preview is a single SQL query (COUNT or a paginated
SELECT) — customer rows are never loaded into memory just to count or list
them. Recipient *snapshot creation* (turning a resolved audience into
`CampaignRecipient` rows) lives in tasks.py, since it runs in the
background via Celery.
"""

from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import get_or_create_credential_row
from app.core.config import settings
from app.models.campaign import AudienceRuleType, Campaign
from app.models.campaign_recipient import (
    CampaignRecipient,
    CampaignRecipientStatus,
    VerificationStatus,
)
from app.models.customer import Customer
from app.models.customer_profile_token import CustomerProfileToken
from app.services.sms_campaigns_audience import AudienceRule, build_condition
from app.services.sms_campaigns_sms_utils import analyze_sms_message
from app.views.sms_campaigns import CampaignRecipientRead, CampaignStats

SMS_GATEWAY_PROVIDER = "sms_gateway"

# The six audience rules with no parameters — what GET /audience-counts
# reports all at once so the campaign composer can show every option's size
# without six round trips. The parametrized rules (NEW_SINCE_DATE,
# NEVER_RECEIVED_TYPE, RECEIVED_TYPE_BEFORE_DATE) go through
# GET /audience-preview instead, one at a time, since they need input.
STATIC_RULE_TYPES = [
    AudienceRuleType.GENERAL,
    AudienceRuleType.VIP,
    AudienceRuleType.VVIP,
    AudienceRuleType.MISSING_DOB,
    AudienceRuleType.MISSING_ADDRESS,
    AudienceRuleType.MISSING_DOB_AND_ADDRESS,
    AudienceRuleType.NEVER_VERIFIED,
    AudienceRuleType.TARGETED_NOT_VERIFIED,
]


async def get_sms_rate_per_segment(db: AsyncSession) -> Decimal:
    """SMS gateways generally don't expose pricing via API, so the rate
    can't be fetched automatically. Reads the admin-editable override
    stored alongside the SMS gateway credentials (see notifications
    settings), falling back to the config default."""
    row = await get_or_create_credential_row(db, SMS_GATEWAY_PROVIDER)
    raw_rate = row.data.get("rate_per_segment_bdt")
    if raw_rate:
        try:
            return Decimal(raw_rate)
        except InvalidOperation:
            pass
    return settings.SMS_RATE_PER_SEGMENT_BDT


async def count_audience(db: AsyncSession, rule: AudienceRule) -> int:
    condition = build_condition(rule)
    result = await db.execute(select(func.count()).select_from(Customer).where(condition))
    return result.scalar_one()


async def count_all_static_audiences(db: AsyncSession) -> dict[str, int]:
    """One COUNT query per static audience rule — six small, independent
    queries rather than one complex conditional-aggregation query, since
    this is a low-traffic admin lookup (not a hot path) and readability
    wins here."""
    return {
        rule_type.value: await count_audience(db, AudienceRule(rule_type=rule_type))
        for rule_type in STATIC_RULE_TYPES
    }


async def preview_audience_recipients(
    db: AsyncSession, rule: AudienceRule, page: int, page_size: int
) -> tuple[list[Customer], int]:
    """A bounded, paginated peek at which customers a rule would match,
    without creating anything — for admin review before confirming a
    campaign. Never loads the full match set."""
    condition = build_condition(rule)

    total = (
        await db.execute(select(func.count()).select_from(Customer).where(condition))
    ).scalar_one()

    rows = (
        await db.execute(
            select(Customer)
            .where(condition)
            .order_by(Customer.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return list(rows), total


async def list_campaign_recipients(
    db: AsyncSession, campaign_id: int, page: int, page_size: int
) -> tuple[list[CampaignRecipientRead], int]:
    """Reads the frozen `CampaignRecipient` snapshot — never re-resolves the
    audience rule. Joins `Customer` only for `public_id`, the API-facing
    identifier."""
    total = (
        await db.execute(
            select(func.count())
            .select_from(CampaignRecipient)
            .where(CampaignRecipient.campaign_id == campaign_id)
        )
    ).scalar_one()

    rows = (
        await db.execute(
            select(CampaignRecipient, Customer.public_id)
            .join(Customer, Customer.id == CampaignRecipient.customer_id)
            .where(CampaignRecipient.campaign_id == campaign_id)
            .order_by(CampaignRecipient.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()

    items = [
        CampaignRecipientRead(
            id=recipient.public_id,
            customer_id=customer_public_id,
            phone=recipient.phone,
            status=recipient.status,
            provider_message_id=recipient.provider_message_id,
            sent_at=recipient.sent_at,
            delivered_at=recipient.delivered_at,
            failed_at=recipient.failed_at,
            failure_reason=recipient.failure_reason,
            created_at=recipient.created_at,
            updated_at=recipient.updated_at,
        )
        for recipient, customer_public_id in rows
    ]
    return items, total


async def get_campaign_stats(db: AsyncSession, campaign_id: int) -> CampaignStats:
    """Recipient status breakdown for one campaign — two small grouped COUNT
    queries (delivery status, verification status), not a Python-side tally
    over loaded rows. These are two independent breakdowns of the same
    `campaign_recipients` rows — a recipient's SMS delivery status and their
    form-verification status are unrelated, so they're grouped separately
    rather than forced into one combined query."""
    status_rows = (
        await db.execute(
            select(CampaignRecipient.status, func.count())
            .where(CampaignRecipient.campaign_id == campaign_id)
            .group_by(CampaignRecipient.status)
        )
    ).all()
    status_counts = {status: count for status, count in status_rows}

    verification_rows = (
        await db.execute(
            select(CampaignRecipient.verification_status, func.count())
            .where(CampaignRecipient.campaign_id == campaign_id)
            .group_by(CampaignRecipient.verification_status)
        )
    ).all()
    verification_counts = {status: count for status, count in verification_rows}

    total = sum(status_counts.values())
    verified = verification_counts.get(VerificationStatus.VERIFIED.value, 0)
    pending_verification = verification_counts.get(VerificationStatus.PENDING.value, 0)
    verification_rate = round((verified / total) * 100, 1) if total else 0.0

    return CampaignStats(
        total=total,
        pending=status_counts.get(CampaignRecipientStatus.PENDING.value, 0),
        sent=status_counts.get(CampaignRecipientStatus.SENT.value, 0),
        delivered=status_counts.get(CampaignRecipientStatus.DELIVERED.value, 0),
        failed=status_counts.get(CampaignRecipientStatus.FAILED.value, 0),
        verified=verified,
        pending_verification=pending_verification,
        verification_rate=verification_rate,
    )


async def get_campaign_by_public_id(db: AsyncSession, public_id: UUID) -> Campaign | None:
    return (
        await db.execute(select(Campaign).where(Campaign.public_id == public_id))
    ).scalar_one_or_none()


def compute_sms_segments(message: str) -> int:
    return analyze_sms_message(message).segment_count


async def get_or_create_campaign_profile_token(
    db: AsyncSession, *, customer_id: int, campaign_id: int
) -> CustomerProfileToken:
    """The secure link put in a campaign SMS. Reuses an existing, still-valid
    token for this exact (customer, campaign) pair instead of always minting
    a new one — a retried send task must not invalidate a link the customer
    may have already received in an earlier attempt."""
    now = datetime.now(UTC)
    existing = (
        await db.execute(
            select(CustomerProfileToken).where(
                CustomerProfileToken.customer_id == customer_id,
                CustomerProfileToken.campaign_id == campaign_id,
                CustomerProfileToken.revoked_at.is_(None),
                CustomerProfileToken.expires_at > now,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    token = CustomerProfileToken(customer_id=customer_id, campaign_id=campaign_id)
    db.add(token)
    await db.flush()
    return token


async def mark_recipient_verified(db: AsyncSession, recipient: CampaignRecipient) -> None:
    """Called only from the public profile submission flow — see
    app.controllers.public_profile. Idempotent: submitting the form again
    (e.g. the customer double-taps save) doesn't move `verified_at`."""
    if recipient.verification_status == VerificationStatus.VERIFIED.value:
        return
    recipient.verification_status = VerificationStatus.VERIFIED.value
    recipient.verified_at = datetime.now(UTC)
