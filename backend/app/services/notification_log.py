"""Builds the read-only notification log shown on /dashboard/notifications
by fanning in the two real places this app actually sends an SMS from:

- `CampaignRecipient` — one row per customer a campaign sent (or is about
  to send) to. Covers the Campaign / Birthday Wish / VIP Reward types.
- `GiftOrder` (status SENT only — PENDING/SCHEDULED/CANCELLED orders never
  triggered an SMS, so they're not a notification event yet). Covers Gift
  Notification.

There's no delivery-receipt webhook anywhere in this codebase, so
`CampaignRecipientStatus.DELIVERED` is never actually set — `Delivered`
stays a real, reachable status in the API contract, it's just that nothing
currently produces it. That's the honest state of the feature, not a bug.

Each source is fetched with its own bounded, recency-ordered query (capped
at `_SOURCE_FETCH_LIMIT` rows) rather than pushed through a single SQL
UNION — the two tables have nothing in common to join on, and at this app's
scale (a single retail chain's SMS volume) merging two capped, already-
sorted lists in Python is simpler than hand-rolling a heterogeneous UNION
ALL and is more than fast enough.
"""

from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.campaign import Campaign, CampaignType
from app.models.campaign_landing_page import CampaignLandingPage
from app.models.campaign_recipient import CampaignRecipient, CampaignRecipientStatus
from app.models.customer_profile_token import CustomerProfileToken
from app.models.gift_order import GiftOrder, GiftOrderStatus
from app.services.gifts import render_gift_sms_message
from app.services.sms_campaigns_personalization import render_message
from app.views.notification_log import (
    NotificationRecord,
    NotificationStats,
    NotificationStatus,
    NotificationType,
)

_SOURCE_FETCH_LIMIT = 1000

_RECIPIENT_STATUS_MAP: dict[str, NotificationStatus] = {
    CampaignRecipientStatus.PENDING.value: NotificationStatus.PENDING,
    CampaignRecipientStatus.SENT.value: NotificationStatus.SENT,
    CampaignRecipientStatus.DELIVERED.value: NotificationStatus.DELIVERED,
    CampaignRecipientStatus.FAILED.value: NotificationStatus.FAILED,
}

_CAMPAIGN_TYPE_MAP: dict[str, NotificationType] = {
    CampaignType.BIRTHDAY.value: NotificationType.BIRTHDAY_WISH,
    CampaignType.VIP.value: NotificationType.VIP_REWARD,
    CampaignType.VVIP.value: NotificationType.VIP_REWARD,
}


def _type_for_campaign(campaign_type: str) -> NotificationType:
    return _CAMPAIGN_TYPE_MAP.get(campaign_type, NotificationType.CAMPAIGN)


def _campaign_recipient_to_notification(
    recipient: CampaignRecipient, campaign: Campaign, *, profile_link: str | None
) -> NotificationRecord:
    sort_key = recipient.sent_at or recipient.failed_at or recipient.created_at
    return NotificationRecord(
        id=f"campaign-{recipient.public_id}",
        channel="SMS",
        type=_type_for_campaign(campaign.campaign_type),
        recipient_name=recipient.name,
        recipient_contact=recipient.phone,
        subject=campaign.name,
        message=render_message(
            campaign.message, customer_name=recipient.name, profile_link=profile_link
        ),
        status=_RECIPIENT_STATUS_MAP.get(recipient.status, NotificationStatus.PENDING),
        sent_at=sort_key,
        delivered_at=recipient.delivered_at,
        failure_reason=recipient.failure_reason,
    )


def _gift_order_to_notification(order: GiftOrder) -> NotificationRecord:
    return NotificationRecord(
        id=f"gift-{order.public_id}",
        channel="SMS",
        type=NotificationType.GIFT_NOTIFICATION,
        recipient_name=order.customer.name,
        recipient_contact=order.customer.phone,
        subject="Your gift is on the way",
        message=render_gift_sms_message(
            customer_name=order.customer.name,
            gift_name=order.gift_name,
            wish_text=order.wish_text,
        ),
        status=NotificationStatus.FAILED if order.notification_error else NotificationStatus.SENT,
        sent_at=order.sent_at,
        delivered_at=None,
        failure_reason=order.notification_error,
    )


async def _build_profile_link_lookup(
    db: AsyncSession, recipient_rows: list[tuple[CampaignRecipient, Campaign]]
) -> dict[tuple[int, int], str]:
    """Reconstructs the exact `{{profile_link}}` URL each recipient's SMS
    actually carried, so the log shows the real link rather than the raw,
    unresolved `{{profile_link}}` token. Read-only — looks up the token
    already issued at send time (see app.tasks.sms_campaigns), never issues
    a new one just to render a log entry."""
    campaign_ids = {campaign.id for _, campaign in recipient_rows}
    if not campaign_ids:
        return {}

    landing_pages = (
        await db.execute(
            select(CampaignLandingPage).where(
                CampaignLandingPage.campaign_id.in_(campaign_ids),
                CampaignLandingPage.published.is_(True),
            )
        )
    ).scalars().all()
    slug_by_campaign_id = {page.campaign_id: page.slug for page in landing_pages}
    if not slug_by_campaign_id:
        return {}

    tokens = (
        await db.execute(
            select(CustomerProfileToken)
            .where(CustomerProfileToken.campaign_id.in_(slug_by_campaign_id))
            .order_by(CustomerProfileToken.id)
        )
    ).scalars().all()

    links: dict[tuple[int, int], str] = {}
    for token in tokens:
        slug = slug_by_campaign_id.get(token.campaign_id)
        if slug is None:
            continue
        # Ordered ascending by id and overwritten on each match, so the
        # most recently issued token for a (customer, campaign) pair wins —
        # matches get_or_create_campaign_profile_token's "reused on retry"
        # semantics.
        links[(token.customer_id, token.campaign_id)] = (
            f"{settings.FRONTEND_BASE_URL}/campaign/{slug}?token={token.token}"
        )
    return links


async def _fetch_all_notifications(db: AsyncSession, *, search: str) -> list[NotificationRecord]:
    recipient_query = (
        select(CampaignRecipient, Campaign)
        .join(Campaign, Campaign.id == CampaignRecipient.campaign_id)
        .order_by(CampaignRecipient.id.desc())
        .limit(_SOURCE_FETCH_LIMIT)
    )
    if search:
        like = f"%{search}%"
        recipient_query = recipient_query.where(
            or_(CampaignRecipient.name.ilike(like), Campaign.name.ilike(like))
        )
    recipient_rows = (await db.execute(recipient_query)).all()
    profile_links = await _build_profile_link_lookup(db, recipient_rows)

    gift_query = (
        select(GiftOrder)
        .where(GiftOrder.status == GiftOrderStatus.SENT.value)
        .order_by(GiftOrder.id.desc())
        .limit(_SOURCE_FETCH_LIMIT)
    )
    gift_orders = (await db.execute(gift_query)).scalars().all()
    if search:
        needle = search.lower()
        subject_matches = needle in "your gift is on the way"
        gift_orders = [
            order
            for order in gift_orders
            if subject_matches or needle in order.customer.name.lower()
        ]

    records = [
        _campaign_recipient_to_notification(
            recipient,
            campaign,
            profile_link=profile_links.get((recipient.customer_id, campaign.id)),
        )
        for recipient, campaign in recipient_rows
    ] + [_gift_order_to_notification(order) for order in gift_orders]

    # A CampaignRecipient that's still PENDING has no sent_at yet — sort it
    # to the back rather than crashing the comparison (None isn't orderable
    # against a real datetime) or letting it float to the top.
    _NEVER_SENT = datetime.min.replace(tzinfo=UTC)
    records.sort(key=lambda record: record.sent_at or _NEVER_SENT, reverse=True)
    return records


async def list_notifications(
    db: AsyncSession,
    *,
    status: NotificationStatus | None = None,
    type: NotificationType | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 100,
) -> tuple[list[NotificationRecord], int]:
    records = await _fetch_all_notifications(db, search=(search or "").strip())

    if status is not None:
        records = [record for record in records if record.status == status]
    if type is not None:
        records = [record for record in records if record.type == type]

    total = len(records)
    start = (page - 1) * page_size
    return records[start : start + page_size], total


async def get_notification_stats(db: AsyncSession) -> NotificationStats:
    records = await _fetch_all_notifications(db, search="")
    total = len(records)
    delivered = sum(1 for record in records if record.status == NotificationStatus.DELIVERED)
    failed = sum(1 for record in records if record.status == NotificationStatus.FAILED)
    delivery_rate = round((delivered / total) * 100) if total else 0
    return NotificationStats(
        total=total, delivered=delivered, failed=failed, delivery_rate=delivery_rate
    )
