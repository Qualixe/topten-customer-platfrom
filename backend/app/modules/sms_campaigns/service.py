"""SMS campaign service: audience resolution, rate lookup, campaign CRUD
orchestration, and recipient/stat queries.

Every audience count/preview is a single SQL query (COUNT or a paginated
SELECT) — customer rows are never loaded into memory just to count or list
them. Recipient *snapshot creation* (turning a resolved audience into
`CampaignRecipient` rows) lives in tasks.py, since it runs in the
background via Celery.
"""

from decimal import Decimal, InvalidOperation
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import get_or_create_credential_row
from app.core.config import settings
from app.database.models.campaign import AudienceRuleType, Campaign
from app.database.models.campaign_recipient import CampaignRecipient, CampaignRecipientStatus
from app.database.models.customer import Customer
from app.modules.sms_campaigns.audience import AudienceRule, build_condition
from app.modules.sms_campaigns.schemas import CampaignRecipientRead, CampaignStats
from app.modules.sms_campaigns.sms_utils import analyze_sms_message

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
    """Recipient status breakdown for one campaign — a single grouped
    COUNT query, not a Python-side tally over loaded rows."""
    rows = (
        await db.execute(
            select(CampaignRecipient.status, func.count())
            .where(CampaignRecipient.campaign_id == campaign_id)
            .group_by(CampaignRecipient.status)
        )
    ).all()
    counts = {status: count for status, count in rows}

    return CampaignStats(
        total=sum(counts.values()),
        pending=counts.get(CampaignRecipientStatus.PENDING.value, 0),
        sent=counts.get(CampaignRecipientStatus.SENT.value, 0),
        delivered=counts.get(CampaignRecipientStatus.DELIVERED.value, 0),
        failed=counts.get(CampaignRecipientStatus.FAILED.value, 0),
    )


async def get_campaign_by_public_id(db: AsyncSession, public_id: UUID) -> Campaign | None:
    return (
        await db.execute(select(Campaign).where(Campaign.public_id == public_id))
    ).scalar_one_or_none()


def compute_sms_segments(message: str) -> int:
    return analyze_sms_message(message).segment_count
