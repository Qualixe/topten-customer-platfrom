"""Exercises `retry_stuck_unresolved_campaigns_async` — the safety net that
re-enqueues audience resolution for a campaign whose initial
resolve_campaign_audience.delay() call was lost (e.g. a broker hiccup),
which otherwise sits "Resolving…" forever. Never touches Celery/a real
broker: `resolve_campaign_audience` is mocked in every test here."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign, CampaignStatus
from app.models.customer import Customer
from app.tasks.sms_campaigns import (
    _STUCK_UNRESOLVED_AFTER,
    resolve_campaign_audience_async,
    retry_stuck_unresolved_campaigns_async,
)
from tests.conftest import TestSessionLocal
from tests.support import get_customer_type_id


async def _add_customer(db_session: AsyncSession) -> Customer:
    customer = Customer(
        name="A",
        phone="+8801711000101",
        normalized_phone="+8801711000101",
        customer_type_id=await get_customer_type_id(db_session),
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def _unresolved_campaign(db_session: AsyncSession, customer: Customer, *, created_at) -> Campaign:
    campaign = Campaign(
        name="Stuck",
        campaign_type="PROMOTIONAL",
        audience_rule_type="SPECIFIC_CUSTOMERS",
        audience_rule_params={"customer_ids": [str(customer.public_id)]},
        message="Hi",
        sender_id="TOPTEN",
        status=CampaignStatus.SCHEDULED.value,
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)
    # created_at has a server_default of now() — override it directly to
    # simulate a campaign that's been stuck for a while.
    campaign.created_at = created_at
    await db_session.commit()
    await db_session.refresh(campaign)
    return campaign


async def test_retries_a_long_stuck_unresolved_campaign(db_session: AsyncSession) -> None:
    customer = await _add_customer(db_session)
    stuck = await _unresolved_campaign(
        db_session,
        customer,
        created_at=datetime.now(UTC) - timedelta(seconds=_STUCK_UNRESOLVED_AFTER + 60),
    )

    with patch("app.tasks.sms_campaigns.resolve_campaign_audience") as mock_task:
        count = await retry_stuck_unresolved_campaigns_async(session_factory=TestSessionLocal)

    mock_task.delay.assert_called_once_with(stuck.id)
    assert count == 1


async def test_leaves_a_recently_created_unresolved_campaign_alone(db_session: AsyncSession) -> None:
    """Still legitimately in flight — resolution normally finishes in
    seconds, so a campaign created moments ago shouldn't be retried yet."""
    customer = await _add_customer(db_session)
    await _unresolved_campaign(db_session, customer, created_at=datetime.now(UTC))

    with patch("app.tasks.sms_campaigns.resolve_campaign_audience") as mock_task:
        count = await retry_stuck_unresolved_campaigns_async(session_factory=TestSessionLocal)

    mock_task.delay.assert_not_called()
    assert count == 0


async def test_leaves_an_already_resolved_campaign_alone(db_session: AsyncSession) -> None:
    customer = await _add_customer(db_session)
    campaign = await _unresolved_campaign(
        db_session,
        customer,
        created_at=datetime.now(UTC) - timedelta(seconds=_STUCK_UNRESOLVED_AFTER + 60),
    )
    await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)

    with patch("app.tasks.sms_campaigns.resolve_campaign_audience") as mock_task:
        count = await retry_stuck_unresolved_campaigns_async(session_factory=TestSessionLocal)

    mock_task.delay.assert_not_called()
    assert count == 0
