"""Exercises `send_campaign_messages_async` — the actual send-to-recipients
logic the Celery task wraps — directly against the test database. Never
hits a real gateway: `gateway_send_sms` (the aliased import in
`app.tasks.sms_campaigns`) is mocked in every test here.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import merge_credential_data
from app.common.sms_gateway_client import SendSmsResult
from app.models.campaign import Campaign, CampaignStatus
from app.models.campaign_recipient import CampaignRecipient, CampaignRecipientStatus
from app.models.customer import Customer
from app.services.sms_campaigns import SMS_GATEWAY_PROVIDER
from app.tasks.sms_campaigns import (
    resolve_campaign_audience_async,
    send_campaign_messages_async,
)
from tests.conftest import TestSessionLocal


async def _add_customer(db_session: AsyncSession, *, name: str, phone: str) -> Customer:
    customer = Customer(name=name, phone=phone, normalized_phone=phone, customer_type="GENERAL")
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def _create_resolved_campaign(
    db_session: AsyncSession, customers: list[Customer], *, sender_id: str = "TOPTEN"
) -> Campaign:
    campaign = Campaign(
        name="Test campaign",
        campaign_type="PROMOTIONAL",
        audience_rule_type="SPECIFIC_CUSTOMERS",
        audience_rule_params={"customer_ids": [str(c.public_id) for c in customers]},
        message="Hello!",
        sender_id=sender_id,
        status=CampaignStatus.SCHEDULED.value,
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)
    await db_session.refresh(campaign)
    return campaign


async def _set_credentials(db_session: AsyncSession, data: dict) -> None:
    # `send_campaign_messages_async` opens its own session via
    # `session_factory` (here, `TestSessionLocal`) rather than reusing
    # `db_session`, so credentials must be committed through that same
    # factory to be visible to it — not through `db_session` directly.
    async with TestSessionLocal() as session:
        await merge_credential_data(session, SMS_GATEWAY_PROVIDER, data)


async def _recipients(db_session: AsyncSession, campaign_id: int) -> list[CampaignRecipient]:
    rows = (
        await db_session.execute(
            select(CampaignRecipient)
            .where(CampaignRecipient.campaign_id == campaign_id)
            .order_by(CampaignRecipient.id)
        )
    ).scalars().all()
    return list(rows)


async def test_send_with_no_credentials_marks_campaign_failed(db_session: AsyncSession) -> None:
    customer = await _add_customer(db_session, name="A", phone="+8801711000101")
    campaign = await _create_resolved_campaign(db_session, [customer])

    await send_campaign_messages_async(campaign.id, session_factory=TestSessionLocal)

    await db_session.refresh(campaign)
    assert campaign.status == CampaignStatus.FAILED.value
    recipients = await _recipients(db_session, campaign.id)
    assert recipients[0].status == CampaignRecipientStatus.PENDING.value  # untouched


async def test_successful_send_marks_recipients_sent_and_campaign_completed(
    db_session: AsyncSession,
) -> None:
    await _set_credentials(
        db_session,
        {"api_url": "https://example.com/api/smsapi", "api_key": "key", "sender_id": "IGNORED"},
    )
    customer = await _add_customer(db_session, name="A", phone="+8801711000101")
    campaign = await _create_resolved_campaign(db_session, [customer], sender_id="CAMPAIGNSENDER")

    mock_result = SendSmsResult(success=True, http_status=200, message="OK")
    with patch(
        "app.tasks.sms_campaigns.gateway_send_sms", new=AsyncMock(return_value=mock_result)
    ) as mock_send:
        await send_campaign_messages_async(campaign.id, session_factory=TestSessionLocal)

    await db_session.refresh(campaign)
    assert campaign.status == CampaignStatus.COMPLETED.value

    recipients = await _recipients(db_session, campaign.id)
    assert recipients[0].status == CampaignRecipientStatus.SENT.value
    assert recipients[0].sent_at is not None

    # Uses the campaign's own sender_id, not whatever's stored in gateway
    # credentials — a campaign can be created with a different sender ID.
    _, kwargs = mock_send.call_args
    assert kwargs["sender_id"] == "CAMPAIGNSENDER"
    assert kwargs["number"] == "+8801711000101"
    assert kwargs["message"] == "Hello!"


async def test_message_template_is_personalized_per_recipient(db_session: AsyncSession) -> None:
    """The bug this was built to fix: {{customer_name}} must be replaced
    with each recipient's real name before sending, not sent literally."""
    await _set_credentials(
        db_session, {"api_url": "https://example.com/api/smsapi", "api_key": "key"}
    )
    customer_a = await _add_customer(db_session, name="Rahim Uddin", phone="+8801711000101")
    customer_b = await _add_customer(db_session, name="Karim Ahmed", phone="+8801711000102")
    campaign = await _create_resolved_campaign(db_session, [customer_a, customer_b])
    campaign.message = "{{customer_name}} Hi How are you, this is for testing"
    db_session.add(campaign)
    await db_session.commit()

    mock_result = SendSmsResult(success=True, http_status=200, message="OK")
    with patch(
        "app.tasks.sms_campaigns.gateway_send_sms", new=AsyncMock(return_value=mock_result)
    ) as mock_send:
        await send_campaign_messages_async(campaign.id, session_factory=TestSessionLocal)

    sent_messages = {
        call.kwargs["number"]: call.kwargs["message"] for call in mock_send.await_args_list
    }
    assert sent_messages["+8801711000101"] == "Rahim Uddin Hi How are you, this is for testing"
    assert sent_messages["+8801711000102"] == "Karim Ahmed Hi How are you, this is for testing"

    # The stored campaign.message stays the raw template — only what's
    # actually sent is personalized.
    await db_session.refresh(campaign)
    assert campaign.message == "{{customer_name}} Hi How are you, this is for testing"


async def test_provider_failure_marks_recipient_failed_without_stopping_others(
    db_session: AsyncSession,
) -> None:
    await _set_credentials(
        db_session, {"api_url": "https://example.com/api/smsapi", "api_key": "key"}
    )
    customer_a = await _add_customer(db_session, name="A", phone="+8801711000101")
    customer_b = await _add_customer(db_session, name="B", phone="+8801711000102")
    campaign = await _create_resolved_campaign(db_session, [customer_a, customer_b])

    # Recipient processing order isn't guaranteed (no ORDER BY on the
    # PENDING query, and SPECIFIC_CUSTOMERS resolution doesn't preserve the
    # input customer_ids order either) — key the fake failure off which
    # number was actually dialed rather than call position.
    async def _fake_send(*, number: str, **_kwargs: object) -> SendSmsResult:
        if number == "+8801711000101":
            return SendSmsResult(success=False, http_status=401, message="bad key")
        return SendSmsResult(success=True, http_status=200, message="OK")

    with patch("app.tasks.sms_campaigns.gateway_send_sms", new=AsyncMock(side_effect=_fake_send)):
        await send_campaign_messages_async(campaign.id, session_factory=TestSessionLocal)

    await db_session.refresh(campaign)
    assert campaign.status == CampaignStatus.COMPLETED.value

    recipients = await _recipients(db_session, campaign.id)
    statuses = {r.phone: r.status for r in recipients}
    assert statuses["+8801711000101"] == CampaignRecipientStatus.FAILED.value
    assert statuses["+8801711000102"] == CampaignRecipientStatus.SENT.value

    failed = next(r for r in recipients if r.phone == "+8801711000101")
    assert "bad key" in failed.failure_reason


async def test_network_error_marks_recipient_failed(db_session: AsyncSession) -> None:
    await _set_credentials(
        db_session, {"api_url": "https://example.com/api/smsapi", "api_key": "key"}
    )
    customer = await _add_customer(db_session, name="A", phone="+8801711000101")
    campaign = await _create_resolved_campaign(db_session, [customer])

    with patch(
        "app.tasks.sms_campaigns.gateway_send_sms",
        new=AsyncMock(side_effect=httpx.ConnectTimeout("timed out")),
    ):
        await send_campaign_messages_async(campaign.id, session_factory=TestSessionLocal)

    await db_session.refresh(campaign)
    assert campaign.status == CampaignStatus.COMPLETED.value
    recipients = await _recipients(db_session, campaign.id)
    assert recipients[0].status == CampaignRecipientStatus.FAILED.value
    assert "timed out" in recipients[0].failure_reason


async def test_already_completed_campaign_is_not_resent(db_session: AsyncSession) -> None:
    await _set_credentials(
        db_session, {"api_url": "https://example.com/api/smsapi", "api_key": "key"}
    )
    customer = await _add_customer(db_session, name="A", phone="+8801711000101")
    campaign = await _create_resolved_campaign(db_session, [customer])

    campaign.status = CampaignStatus.COMPLETED.value
    db_session.add(campaign)
    await db_session.commit()

    with patch(
        "app.tasks.sms_campaigns.gateway_send_sms", new=AsyncMock()
    ) as mock_send:
        await send_campaign_messages_async(campaign.id, session_factory=TestSessionLocal)

    mock_send.assert_not_awaited()


async def test_unresolved_campaign_is_not_sent(db_session: AsyncSession) -> None:
    campaign = Campaign(
        name="Unresolved",
        campaign_type="PROMOTIONAL",
        audience_rule_type="GENERAL",
        audience_rule_params={},
        message="Hi",
        sender_id="TOPTEN",
        status=CampaignStatus.SCHEDULED.value,
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    with patch(
        "app.tasks.sms_campaigns.gateway_send_sms", new=AsyncMock()
    ) as mock_send:
        await send_campaign_messages_async(campaign.id, session_factory=TestSessionLocal)

    mock_send.assert_not_awaited()


async def test_resolve_triggers_send_only_for_due_campaigns(db_session: AsyncSession) -> None:
    """A "send now" campaign (scheduled_at already in the past by the time
    resolution finishes) triggers a send; a future-scheduled one doesn't."""
    customer = await _add_customer(db_session, name="A", phone="+8801711000101")

    due_campaign = Campaign(
        name="Due now",
        campaign_type="PROMOTIONAL",
        audience_rule_type="SPECIFIC_CUSTOMERS",
        audience_rule_params={"customer_ids": [str(customer.public_id)]},
        message="Hi",
        sender_id="TOPTEN",
        status=CampaignStatus.SCHEDULED.value,
        scheduled_at=datetime.now(UTC) - timedelta(seconds=5),
    )
    future_campaign = Campaign(
        name="Future",
        campaign_type="PROMOTIONAL",
        audience_rule_type="SPECIFIC_CUSTOMERS",
        audience_rule_params={"customer_ids": [str(customer.public_id)]},
        message="Hi",
        sender_id="TOPTEN",
        status=CampaignStatus.SCHEDULED.value,
        scheduled_at=datetime.now(UTC) + timedelta(days=1),
    )
    db_session.add_all([due_campaign, future_campaign])
    await db_session.commit()
    await db_session.refresh(due_campaign)
    await db_session.refresh(future_campaign)

    with patch("app.tasks.sms_campaigns.send_campaign_messages") as mock_task:
        await resolve_campaign_audience_async(due_campaign.id, session_factory=TestSessionLocal)
        await resolve_campaign_audience_async(future_campaign.id, session_factory=TestSessionLocal)

    mock_task.delay.assert_called_once_with(due_campaign.id)
