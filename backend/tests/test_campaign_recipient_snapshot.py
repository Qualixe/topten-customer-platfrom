"""Exercises the actual recipient-snapshot resolution logic
(`resolve_campaign_audience_async`) directly against the test database —
the same function the Celery task wraps in `asyncio.run()`. Covers the
scenarios explicitly called out in the task: large-scale resolution,
identifying only newly-imported customers, snapshot immutability, and
duplicate-safe (idempotent) re-resolution.

Customers are bulk-inserted via SQLAlchemy Core (one INSERT with many rows)
rather than one ORM object at a time — creating 10,000+ rows through the
ORM one-by-one would make this suite too slow to run routinely.
"""

import asyncio
from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.campaign_recipient import CampaignRecipient
from app.models.customer import Customer
from app.tasks.sms_campaigns import resolve_campaign_audience_async
from tests.conftest import TestSessionLocal

DAY_1 = datetime(2026, 8, 19, 9, 0, tzinfo=UTC)
DAY_2 = datetime(2026, 8, 20, 9, 0, tzinfo=UTC)


def _customer_rows(count: int, *, start: int, created_at: datetime) -> list[dict]:
    return [
        {
            "name": f"Customer {start + i}",
            "phone": f"+88017{start + i:08d}",
            "normalized_phone": f"+88017{start + i:08d}",
            "customer_type": "GENERAL",
            "created_at": created_at,
        }
        for i in range(count)
    ]


async def _bulk_insert_customers(
    db_session: AsyncSession, count: int, *, start: int, created_at: datetime
) -> None:
    rows = _customer_rows(count, start=start, created_at=created_at)
    await db_session.execute(Customer.__table__.insert(), rows)
    await db_session.commit()


async def _create_campaign(
    db_session: AsyncSession,
    *,
    rule_type: str = "GENERAL",
    rule_params: dict | None = None,
    campaign_type: str = "PROMOTIONAL",
) -> Campaign:
    campaign = Campaign(
        name="Campaign A",
        campaign_type=campaign_type,
        audience_rule_type=rule_type,
        audience_rule_params=rule_params or {},
        message="Hello!",
        sender_id="TopTen",
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)
    return campaign


async def _recipient_count(db_session: AsyncSession, campaign_id: int) -> int:
    return (
        await db_session.execute(
            select(func.count())
            .select_from(CampaignRecipient)
            .where(CampaignRecipient.campaign_id == campaign_id)
        )
    ).scalar_one()


async def test_resolves_10000_customers_into_recipient_snapshot(db_session: AsyncSession) -> None:
    """Scenario 1: 10,000 customers -> Campaign A."""
    await _bulk_insert_customers(db_session, 10_000, start=0, created_at=DAY_1)
    campaign = await _create_campaign(db_session, rule_type="GENERAL")

    await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)

    await db_session.refresh(campaign)
    assert campaign.total_recipients == 10_000
    assert campaign.recipients_resolved_at is not None
    assert await _recipient_count(db_session, campaign.id) == 10_000


async def test_new_customers_since_campaign_a_identifies_only_the_delta(
    db_session: AsyncSession,
) -> None:
    """Scenarios 2 and 3: Day 1, 10,000 customers -> Campaign A. Day 2,
    10,000 more are imported. "New customers since Campaign A" must return
    only the new 10,000 — the Day 1 customers must not be considered new."""
    await _bulk_insert_customers(db_session, 10_000, start=0, created_at=DAY_1)
    campaign_a = await _create_campaign(db_session, rule_type="GENERAL")
    await resolve_campaign_audience_async(campaign_a.id, session_factory=TestSessionLocal)
    await db_session.refresh(campaign_a)

    await _bulk_insert_customers(db_session, 10_000, start=10_000, created_at=DAY_2)

    campaign_b = await _create_campaign(
        db_session,
        rule_type="NEW_SINCE_DATE",
        rule_params={"since_date": DAY_2.date().isoformat()},
    )
    await resolve_campaign_audience_async(campaign_b.id, session_factory=TestSessionLocal)
    await db_session.refresh(campaign_b)

    assert campaign_b.total_recipients == 10_000

    phone_query = select(CampaignRecipient.phone).where(
        CampaignRecipient.campaign_id == campaign_b.id
    )
    recipient_phones = set((await db_session.execute(phone_query)).scalars().all())
    # None of Day 1's customers (phones ending in the first 10,000 range) leaked in.
    assert "+88017" + f"{0:08d}" not in recipient_phones
    assert "+88017" + f"{10_000:08d}" in recipient_phones


async def test_snapshot_unchanged_after_later_import(db_session: AsyncSession) -> None:
    """Scenario 9: importing more matching customers after a campaign's
    audience has been resolved must not retroactively grow that campaign's
    recipient snapshot."""
    await _bulk_insert_customers(db_session, 100, start=0, created_at=DAY_1)
    campaign = await _create_campaign(db_session, rule_type="GENERAL")
    await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)
    await db_session.refresh(campaign)
    assert campaign.total_recipients == 100

    await _bulk_insert_customers(db_session, 50, start=100, created_at=DAY_2)

    assert await _recipient_count(db_session, campaign.id) == 100
    await db_session.refresh(campaign)
    assert campaign.total_recipients == 100


async def test_resolving_twice_does_not_duplicate_recipients(db_session: AsyncSession) -> None:
    """Scenario 8: duplicate campaign recipients must never be created, even
    if resolution effectively re-runs (e.g. a redelivered Celery task after
    a worker crash, before the first run's commit was acknowledged)."""
    await _bulk_insert_customers(db_session, 50, start=0, created_at=DAY_1)
    campaign = await _create_campaign(db_session, rule_type="GENERAL")

    await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)
    assert await _recipient_count(db_session, campaign.id) == 50

    # Simulate a retry that never got to record success last time.
    reset_stmt = (
        Campaign.__table__.update()
        .where(Campaign.id == campaign.id)
        .values(recipients_resolved_at=None)
    )
    await db_session.execute(reset_stmt)
    await db_session.commit()

    await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)

    assert await _recipient_count(db_session, campaign.id) == 50
    await db_session.refresh(campaign)
    assert campaign.total_recipients == 50


async def test_duplicate_campaign_recipient_row_violates_unique_constraint(
    db_session: AsyncSession,
) -> None:
    await _bulk_insert_customers(db_session, 1, start=0, created_at=DAY_1)
    customer = (await db_session.execute(select(Customer))).scalars().first()
    campaign = await _create_campaign(db_session, rule_type="GENERAL")

    def _recipient() -> CampaignRecipient:
        return CampaignRecipient(
            campaign_id=campaign.id,
            customer_id=customer.id,
            phone=customer.phone,
            name=customer.name,
        )

    db_session.add(_recipient())
    await db_session.commit()

    db_session.add(_recipient())
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


async def test_already_resolved_campaign_is_not_re_resolved(db_session: AsyncSession) -> None:
    """Once `recipients_resolved_at` is set, calling resolution again must
    be a pure no-op — it must not re-query the audience at all, even if the
    audience would now match different customers."""
    await _bulk_insert_customers(db_session, 10, start=0, created_at=DAY_1)
    campaign = await _create_campaign(db_session, rule_type="GENERAL")
    await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)

    await _bulk_insert_customers(db_session, 20, start=10, created_at=DAY_2)

    await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)

    assert await _recipient_count(db_session, campaign.id) == 10


async def test_large_dataset_never_received_type_query(db_session: AsyncSession) -> None:
    """Scenario 10: a large-dataset correctness check for the
    NEVER_RECEIVED_TYPE rule's NOT EXISTS subquery — 12,000 customers, a
    subset of which already received a PROFILE_COMPLETION campaign."""
    await _bulk_insert_customers(db_session, 12_000, start=0, created_at=DAY_1)

    # Autoincrement ids are never reset between tests (the cleanup fixture
    # uses DELETE, not TRUNCATE ... RESTART IDENTITY), so anchor "the first
    # 1,200 rows of this batch" off this batch's own min id rather than an
    # absolute id value.
    vip_count = 1_200
    min_id = (await db_session.execute(select(func.min(Customer.id)))).scalar_one()
    await db_session.execute(
        Customer.__table__.update()
        .where(Customer.id < min_id + vip_count)
        .values(customer_type="VIP")
    )
    await db_session.commit()

    campaign_a = await _create_campaign(
        db_session, rule_type="VIP", campaign_type="PROFILE_COMPLETION"
    )
    await resolve_campaign_audience_async(campaign_a.id, session_factory=TestSessionLocal)
    await db_session.refresh(campaign_a)
    assert campaign_a.total_recipients == vip_count

    campaign_b = await _create_campaign(
        db_session,
        rule_type="NEVER_RECEIVED_TYPE",
        rule_params={"campaign_type": "PROFILE_COMPLETION"},
    )
    await resolve_campaign_audience_async(campaign_b.id, session_factory=TestSessionLocal)
    await db_session.refresh(campaign_b)

    assert campaign_b.total_recipients == 12_000 - vip_count


async def test_concurrent_campaign_resolution_stays_isolated(db_session: AsyncSession) -> None:
    """Two campaigns targeting the same audience, resolved concurrently
    (simulating two Celery workers picking up two campaigns at once), must
    each end up with their own correct, non-interfering recipient count —
    the unique constraint is scoped to (campaign_id, customer_id), so one
    campaign's rows can never collide with another's."""
    await _bulk_insert_customers(db_session, 500, start=0, created_at=DAY_1)
    campaign_x = await _create_campaign(db_session, rule_type="GENERAL")
    campaign_y = await _create_campaign(db_session, rule_type="GENERAL")

    await asyncio.gather(
        resolve_campaign_audience_async(campaign_x.id, session_factory=TestSessionLocal),
        resolve_campaign_audience_async(campaign_y.id, session_factory=TestSessionLocal),
    )

    assert await _recipient_count(db_session, campaign_x.id) == 500
    assert await _recipient_count(db_session, campaign_y.id) == 500

    await db_session.refresh(campaign_x)
    await db_session.refresh(campaign_y)
    assert campaign_x.total_recipients == 500
    assert campaign_y.total_recipients == 500
