"""Background resolution of a campaign's audience rule into a frozen
`CampaignRecipient` snapshot.

Runs exactly once per campaign, triggered right after creation. It never
re-runs for a campaign that already has a snapshot (see the
`recipients_resolved_at` guard below) — that's what guarantees a campaign's
recipient list stays fixed even if the audience rule would now match
different customers (e.g. after a later import).

Idempotency: the insert is a single `INSERT ... SELECT ... ON CONFLICT DO
NOTHING` keyed on the (campaign_id, customer_id) unique constraint, and
`total_recipients`/`estimated_cost` are always recomputed from a fresh COUNT
of `campaign_recipients` afterward rather than incremented — so a
redelivered/retried task (worker crash, `acks_late`) can safely re-run the
whole thing from scratch without ever double-inserting or double-counting.
"""

import asyncio
from datetime import UTC, datetime

from sqlalchemy import func, literal, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.celery_app import celery_app
from app.database import SessionLocal, engine
from app.models.campaign import Campaign
from app.models.campaign_recipient import CampaignRecipient, CampaignRecipientStatus
from app.models.customer import Customer
from app.services.sms_campaigns import get_sms_rate_per_segment
from app.services.sms_campaigns_audience import AudienceRule, build_condition
from app.services.sms_campaigns_sms_utils import estimate_sms_cost


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

        # public_id must be generated per matched row, not once for the
        # whole statement — an ORM Python-side default (uuid.uuid4) on an
        # INSERT...SELECT is evaluated exactly once and reused for every
        # row, which would violate the unique constraint the moment more
        # than one customer matches. gen_random_uuid() runs per row in SQL.
        select_matching_customers = select(
            literal(campaign.id),
            Customer.id,
            Customer.phone,
            literal(CampaignRecipientStatus.PENDING.value),
            func.gen_random_uuid(),
        ).where(condition)

        insert_stmt = pg_insert(CampaignRecipient).from_select(
            ["campaign_id", "customer_id", "phone", "status", "public_id"],
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

        rate = await get_sms_rate_per_segment(session)
        estimated_cost = estimate_sms_cost(campaign.sms_segments, total_recipients, rate)

        campaign.total_recipients = total_recipients
        campaign.estimated_cost = estimated_cost
        campaign.recipients_resolved_at = datetime.now(UTC)
        await session.commit()


async def _run_and_dispose(campaign_id: int) -> None:
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
    asyncio.run(_run_and_dispose(campaign_id))
