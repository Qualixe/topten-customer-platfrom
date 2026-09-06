"""Exercises `dispatch_due_scheduled_campaigns_async` — the periodic poller
that actually makes "schedule for later" work (see the module docstring of
app.tasks.sms_campaigns). Never touches Celery/a real broker:
`send_campaign_messages` is mocked in every test here, same convention as
test_campaign_sending.py."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign, CampaignStatus
from app.models.customer import Customer
from app.tasks.sms_campaigns import (
    dispatch_due_scheduled_campaigns_async,
    resolve_campaign_audience_async,
)
from tests.conftest import TestSessionLocal
from tests.support import get_customer_type_id


async def _add_customer(db_session: AsyncSession, *, name: str, phone: str) -> Customer:
    customer = Customer(
        name=name,
        phone=phone,
        normalized_phone=phone,
        customer_type_id=await get_customer_type_id(db_session),
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def _resolved_campaign(
    db_session: AsyncSession, customer: Customer, *, name: str, scheduled_at: datetime
) -> Campaign:
    campaign = Campaign(
        name=name,
        campaign_type="PROMOTIONAL",
        audience_rule_type="SPECIFIC_CUSTOMERS",
        audience_rule_params={"customer_ids": [str(customer.public_id)]},
        message="Hi",
        sender_id="TOPTEN",
        status=CampaignStatus.SCHEDULED.value,
        # Far enough in the future that resolve_campaign_audience_async's
        # own "send now" check won't fire — this campaign is meant to stay
        # SCHEDULED until the test itself moves the clock past it.
        scheduled_at=datetime.now(UTC) + timedelta(days=365),
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)
    await db_session.refresh(campaign)

    # Back-dated to the real target after resolution, so resolution's own
    # "send now" auto-trigger never fires for it — only the poller should.
    campaign.scheduled_at = scheduled_at
    await db_session.commit()
    await db_session.refresh(campaign)
    return campaign


async def test_dispatches_only_due_and_resolved_campaigns(db_session: AsyncSession) -> None:
    customer = await _add_customer(db_session, name="A", phone="+8801711000101")

    due = await _resolved_campaign(
        db_session,
        customer,
        name="Due",
        scheduled_at=datetime.now(UTC) - timedelta(seconds=5),
    )
    not_yet_due = await _resolved_campaign(
        db_session,
        customer,
        name="Not yet due",
        scheduled_at=datetime.now(UTC) + timedelta(days=1),
    )

    with patch("app.tasks.sms_campaigns.send_campaign_messages") as mock_task:
        await dispatch_due_scheduled_campaigns_async(session_factory=TestSessionLocal)

    mock_task.delay.assert_called_once_with(due.id)
    assert not_yet_due.id not in [call.args[0] for call in mock_task.delay.call_args_list]


async def test_ignores_unresolved_campaigns_even_if_due(db_session: AsyncSession) -> None:
    """A campaign whose audience hasn't finished resolving isn't ready to
    send — it should pick this up on a later poll once resolution lands,
    not be sent half-formed."""
    customer = await _add_customer(db_session, name="A", phone="+8801711000101")
    unresolved = Campaign(
        name="Unresolved",
        campaign_type="PROMOTIONAL",
        audience_rule_type="SPECIFIC_CUSTOMERS",
        audience_rule_params={"customer_ids": [str(customer.public_id)]},
        message="Hi",
        sender_id="TOPTEN",
        status=CampaignStatus.SCHEDULED.value,
        scheduled_at=datetime.now(UTC) - timedelta(seconds=5),
    )
    db_session.add(unresolved)
    await db_session.commit()

    with patch("app.tasks.sms_campaigns.send_campaign_messages") as mock_task:
        await dispatch_due_scheduled_campaigns_async(session_factory=TestSessionLocal)

    mock_task.delay.assert_not_called()


async def test_ignores_campaigns_already_past_scheduled_status(db_session: AsyncSession) -> None:
    """A campaign already PROCESSING/COMPLETED/etc. is left alone — only
    still-SCHEDULED ones are candidates."""
    customer = await _add_customer(db_session, name="A", phone="+8801711000101")
    campaign = await _resolved_campaign(
        db_session,
        customer,
        name="Already sent",
        scheduled_at=datetime.now(UTC) - timedelta(seconds=5),
    )
    campaign.status = CampaignStatus.COMPLETED.value
    await db_session.commit()

    with patch("app.tasks.sms_campaigns.send_campaign_messages") as mock_task:
        await dispatch_due_scheduled_campaigns_async(session_factory=TestSessionLocal)

    mock_task.delay.assert_not_called()
