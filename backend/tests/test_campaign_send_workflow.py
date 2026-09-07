"""The admin-facing EMAIL campaign send workflow: pre-send validation
(`GET /send-readiness`), the guarded send action itself
(`POST /send-email`), duplicate-send prevention, and the test-send preview
(`POST /preview-email`). `POST /send-email` only ever queues the real send
(via the existing `send_campaign_messages` Celery task, mocked out here) —
the task itself sending correctly and updating recipient statuses is
covered directly against the test database in test_email_campaign_sending.py;
one end-to-end test here (`test_send_email_campaign_end_to_end`) exercises
both halves together."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import merge_credential_data
from app.models.campaign import Campaign, CampaignStatus
from app.models.campaign_recipient import CampaignRecipient, CampaignRecipientStatus
from app.models.customer import Customer
from app.models.user import User
from app.services.mailchimp_sync import MAILCHIMP_PROVIDER
from app.tasks.sms_campaigns import resolve_campaign_audience_async, send_campaign_messages_async
from app.views.mailchimp_marketing import SendCampaignReport, SyncItemResult
from tests.conftest import TestSessionLocal
from tests.support import get_customer_type_id

VALID_MAILCHIMP_CREDENTIALS = {
    "api_key": "abc123-us21",
    "list_id": "list1",
    "from_name": "TopTen",
    "reply_to_email": "hello@topten.test",
}


@pytest.fixture(autouse=True)
def _patch_celery_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.tasks.sms_campaigns.send_campaign_messages.delay", lambda campaign_id: None
    )


async def _add_customer(db_session: AsyncSession, *, name: str, email: str | None) -> Customer:
    customer = Customer(
        name=name,
        phone="+8801711000101",
        normalized_phone=f"+880171100{hash(email) % 10000:04d}",
        email=email,
        customer_type_id=await get_customer_type_id(db_session),
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def _create_email_campaign(
    db_session: AsyncSession,
    *,
    customers: list[Customer] | None = None,
    resolved: bool,
    message: str = "<p>Hello {{customer_name}}!</p>",
    subject: str = "A subject line",
    status: str = CampaignStatus.DRAFT.value,
) -> Campaign:
    customers = customers or []
    campaign = Campaign(
        name="Welcome Back",
        campaign_type="PROMOTIONAL",
        channel="EMAIL",
        audience_rule_type="SPECIFIC_CUSTOMERS",
        audience_rule_params={"customer_ids": [str(c.public_id) for c in customers]},
        message=message,
        subject=subject,
        status=status,
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    if resolved:
        await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)
        await db_session.refresh(campaign)
    return campaign


async def test_send_readiness_reports_every_blocking_reason(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """No recipients resolved, no body, no subject, no credentials — every
    reason should show up at once."""
    campaign = await _create_email_campaign(
        db_session, resolved=False, message="   ", subject="   "
    )

    response = await client.get(f"/api/v1/sms/campaigns/{campaign.public_id}/send-readiness")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["ready"] is False
    reasons = " ".join(data["reasons"])
    assert "Recipient list is still being calculated" in reasons
    assert "no email body" in reasons
    assert "no email subject" in reasons
    assert "not configured" in reasons


async def test_send_readiness_ready_when_everything_configured(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await merge_credential_data(db_session, MAILCHIMP_PROVIDER, VALID_MAILCHIMP_CREDENTIALS)
    customer = await _add_customer(db_session, name="A", email="a@example.com")
    campaign = await _create_email_campaign(db_session, customers=[customer], resolved=True)

    response = await client.get(f"/api/v1/sms/campaigns/{campaign.public_id}/send-readiness")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data == {"ready": True, "reasons": []}


async def test_send_readiness_flags_recipients_with_no_valid_email(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await merge_credential_data(db_session, MAILCHIMP_PROVIDER, VALID_MAILCHIMP_CREDENTIALS)
    # No email on file — excluded from the snapshot entirely by audience
    # resolution for an EMAIL campaign, so this campaign resolves to zero
    # recipients.
    customer = await _add_customer(db_session, name="A", email=None)
    campaign = await _create_email_campaign(db_session, customers=[customer], resolved=True)

    response = await client.get(f"/api/v1/sms/campaigns/{campaign.public_id}/send-readiness")

    data = response.json()["data"]
    assert data["ready"] is False
    assert any("no recipients" in reason.lower() for reason in data["reasons"])


async def test_send_email_campaign_queues_and_flips_status_to_processing(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await merge_credential_data(db_session, MAILCHIMP_PROVIDER, VALID_MAILCHIMP_CREDENTIALS)
    customer = await _add_customer(db_session, name="A", email="a@example.com")
    campaign = await _create_email_campaign(db_session, customers=[customer], resolved=True)

    with patch("app.tasks.sms_campaigns.send_campaign_messages.delay") as mock_delay:
        response = await client.post(f"/api/v1/sms/campaigns/{campaign.public_id}/send-email")

    assert response.status_code == 202
    assert response.json()["data"]["status"] == "PROCESSING"
    mock_delay.assert_called_once_with(campaign.id)


async def test_send_email_campaign_rejects_when_not_ready(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    # No Mailchimp credentials saved at all.
    customer = await _add_customer(db_session, name="A", email="a@example.com")
    campaign = await _create_email_campaign(db_session, customers=[customer], resolved=True)

    with patch("app.tasks.sms_campaigns.send_campaign_messages.delay") as mock_delay:
        response = await client.post(f"/api/v1/sms/campaigns/{campaign.public_id}/send-email")

    assert response.status_code == 422
    mock_delay.assert_not_called()
    await db_session.refresh(campaign)
    assert campaign.status == CampaignStatus.DRAFT.value


async def test_duplicate_send_is_prevented(client: AsyncClient, db_session: AsyncSession) -> None:
    """A second `POST /send-email` for a campaign already PROCESSING (the
    first call's own effect) is rejected rather than queuing a second
    send — the backend, not the frontend, is what makes double-sending
    impossible."""
    await merge_credential_data(db_session, MAILCHIMP_PROVIDER, VALID_MAILCHIMP_CREDENTIALS)
    customer = await _add_customer(db_session, name="A", email="a@example.com")
    campaign = await _create_email_campaign(db_session, customers=[customer], resolved=True)

    with patch("app.tasks.sms_campaigns.send_campaign_messages.delay") as mock_delay:
        first = await client.post(f"/api/v1/sms/campaigns/{campaign.public_id}/send-email")
        second = await client.post(f"/api/v1/sms/campaigns/{campaign.public_id}/send-email")

    assert first.status_code == 202
    assert second.status_code == 422
    detail = second.json()["detail"]
    assert "already been sent" in detail or "currently sending" in detail
    mock_delay.assert_called_once_with(campaign.id)


async def test_send_email_campaign_end_to_end(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Queuing (the HTTP endpoint) and executing (the Celery task body)
    together: after `POST /send-email` queues the send, actually running
    the task marks the recipient SENT and the campaign COMPLETED."""
    await merge_credential_data(db_session, MAILCHIMP_PROVIDER, VALID_MAILCHIMP_CREDENTIALS)
    customer = await _add_customer(db_session, name="A", email="a@example.com")
    campaign = await _create_email_campaign(db_session, customers=[customer], resolved=True)

    response = await client.post(f"/api/v1/sms/campaigns/{campaign.public_id}/send-email")
    assert response.status_code == 202

    mock_report = SendCampaignReport(
        total=1,
        sent=1,
        failed=0,
        items=[
            SyncItemResult(
                customer_id=customer.public_id, email=customer.email, success=True, message="OK"
            )
        ],
    )
    with patch(
        "app.tasks.sms_campaigns.create_and_send_campaign", new=AsyncMock(return_value=mock_report)
    ):
        await send_campaign_messages_async(campaign.id, session_factory=TestSessionLocal)

    await db_session.refresh(campaign)
    assert campaign.status == CampaignStatus.COMPLETED.value

    recipient = (
        await db_session.execute(
            select(CampaignRecipient).where(CampaignRecipient.campaign_id == campaign.id)
        )
    ).scalar_one()
    assert recipient.status == CampaignRecipientStatus.SENT.value


async def test_preview_email_defaults_to_requesting_admin_and_uses_topten_layout(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    campaign = await _create_email_campaign(
        db_session, resolved=False, message="<p>Hi {{customer_name}}!</p>"
    )
    admin = (
        await db_session.execute(select(User).where(User.email == "admin@topten.com.bd"))
    ).scalar_one()

    with patch(
        "app.controllers.sms_campaigns.send_test_campaign", new=AsyncMock()
    ) as mock_preview:
        response = await client.post(
            f"/api/v1/sms/campaigns/{campaign.public_id}/preview-email", json={}
        )

    assert response.status_code == 204
    _, kwargs = mock_preview.call_args
    assert kwargs["test_emails"] == [admin.email]
    assert kwargs["subject"] == "A subject line"
    assert "Hi Sample Customer!" in kwargs["html_body"]
    assert "<!DOCTYPE html>" in kwargs["html_body"]


async def test_preview_email_rejects_when_no_body_yet(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    campaign = await _create_email_campaign(db_session, resolved=False, message="   ")

    with patch("app.controllers.sms_campaigns.send_test_campaign", new=AsyncMock()) as mock_preview:
        response = await client.post(
            f"/api/v1/sms/campaigns/{campaign.public_id}/preview-email", json={}
        )

    assert response.status_code == 422
    mock_preview.assert_not_called()
