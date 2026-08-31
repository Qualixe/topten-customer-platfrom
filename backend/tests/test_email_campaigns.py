"""EMAIL as a campaign channel: creation validation, audience resolution
copying/filtering by email, and the send task's SMTP branch.
"""

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import merge_credential_data
from app.common.email_client import SendEmailResult
from app.models.campaign import Campaign, CampaignStatus
from app.models.campaign_recipient import CampaignRecipient, CampaignRecipientStatus
from app.models.customer import Customer
from app.services.sms_campaigns import EMAIL_PROVIDER
from app.tasks.sms_campaigns import resolve_campaign_audience_async, send_campaign_messages_async
from tests.conftest import TestSessionLocal


def _email_payload(**overrides) -> dict:
    payload = {
        "name": "Newsletter",
        "campaign_type": "PROMOTIONAL",
        "channel": "EMAIL",
        "audience_rule": {"rule_type": "GENERAL"},
        "message": "Hello there!",
        "subject": "This month's newsletter",
    }
    payload.update(overrides)
    return payload


async def _add_customer(
    db_session: AsyncSession, *, name: str, phone: str, email: str | None = None
) -> Customer:
    customer = Customer(name=name, phone=phone, normalized_phone=phone, email=email)
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


# --- Creation validation ---------------------------------------------------


async def test_email_campaign_requires_subject(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/sms/campaigns", json=_email_payload(subject=None)
    )
    assert response.status_code == 422


async def test_email_campaign_does_not_require_sender_id(client: AsyncClient) -> None:
    response = await client.post("/api/v1/sms/campaigns", json=_email_payload())
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["channel"] == "EMAIL"
    assert data["subject"] == "This month's newsletter"
    assert data["sender_id"] is None
    # No per-message cost model for EMAIL.
    assert data["sms_segments"] == 0


async def test_sms_campaign_still_requires_sender_id(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/sms/campaigns",
        json={
            "name": "SMS blast",
            "campaign_type": "PROMOTIONAL",
            "channel": "SMS",
            "audience_rule": {"rule_type": "GENERAL"},
            "message": "Hi",
        },
    )
    assert response.status_code == 422


# --- Audience resolution: copies email, filters null-email for EMAIL ------


async def test_resolution_copies_email_onto_recipient_snapshot(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(
        db_session, name="Rahim", phone="+8801711000101", email="rahim@example.com"
    )
    audience_rule = {
        "rule_type": "SPECIFIC_CUSTOMERS",
        "customer_ids": [str(customer.public_id)],
    }
    created = (
        await client.post(
            "/api/v1/sms/campaigns", json=_email_payload(audience_rule=audience_rule)
        )
    ).json()["data"]

    campaign_row = (
        await db_session.execute(select(Campaign).where(Campaign.public_id == created["id"]))
    ).scalar_one()
    await resolve_campaign_audience_async(campaign_row.id, session_factory=TestSessionLocal)

    recipient = (
        await db_session.execute(
            select(CampaignRecipient).where(CampaignRecipient.campaign_id == campaign_row.id)
        )
    ).scalar_one()
    assert recipient.email == "rahim@example.com"


async def test_email_campaign_excludes_customers_with_no_email(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    with_email = await _add_customer(
        db_session, name="Has Email", phone="+8801711000101", email="has@example.com"
    )
    without_email = await _add_customer(db_session, name="No Email", phone="+8801711000102")

    created = (
        await client.post("/api/v1/sms/campaigns", json=_email_payload())
    ).json()["data"]
    campaign_row = (
        await db_session.execute(select(Campaign).where(Campaign.public_id == created["id"]))
    ).scalar_one()
    await resolve_campaign_audience_async(campaign_row.id, session_factory=TestSessionLocal)
    await db_session.refresh(campaign_row)

    recipients = (
        await db_session.execute(
            select(CampaignRecipient).where(CampaignRecipient.campaign_id == campaign_row.id)
        )
    ).scalars().all()
    recipient_customer_ids = {r.customer_id for r in recipients}
    assert with_email.id in recipient_customer_ids
    assert without_email.id not in recipient_customer_ids
    assert campaign_row.total_recipients == 1


# --- Sending: SMTP branch ---------------------------------------------------


async def _create_resolved_email_campaign(
    db_session: AsyncSession, customers: list[Customer]
) -> Campaign:
    campaign = Campaign(
        name="Newsletter",
        campaign_type="PROMOTIONAL",
        channel="EMAIL",
        audience_rule_type="SPECIFIC_CUSTOMERS",
        audience_rule_params={"customer_ids": [str(c.public_id) for c in customers]},
        message="Hello {{customer_name}}!",
        subject="Hi {{customer_name}}",
        status=CampaignStatus.SCHEDULED.value,
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)
    await db_session.refresh(campaign)
    return campaign


async def _set_email_credentials(db_session: AsyncSession, data: dict) -> None:
    async with TestSessionLocal() as session:
        await merge_credential_data(session, EMAIL_PROVIDER, data)


async def test_send_with_no_mailchimp_credentials_marks_campaign_failed(
    db_session: AsyncSession,
) -> None:
    customer = await _add_customer(
        db_session, name="A", phone="+8801711000101", email="a@example.com"
    )
    campaign = await _create_resolved_email_campaign(db_session, [customer])

    await send_campaign_messages_async(campaign.id, session_factory=TestSessionLocal)

    await db_session.refresh(campaign)
    assert campaign.status == CampaignStatus.FAILED.value


async def test_successful_email_send_marks_recipient_sent(db_session: AsyncSession) -> None:
    await _set_email_credentials(
        db_session, {"api_key": "md-fake-key", "from_address": "noreply@example.com"}
    )
    customer = await _add_customer(
        db_session, name="Rahim", phone="+8801711000101", email="rahim@example.com"
    )
    campaign = await _create_resolved_email_campaign(db_session, [customer])

    mock_result = SendEmailResult(success=True, message="sent")
    with patch(
        "app.tasks.sms_campaigns.mailchimp_send_email", new=AsyncMock(return_value=mock_result)
    ) as mock_send:
        await send_campaign_messages_async(campaign.id, session_factory=TestSessionLocal)

    await db_session.refresh(campaign)
    assert campaign.status == CampaignStatus.COMPLETED.value

    recipient = (
        await db_session.execute(
            select(CampaignRecipient).where(CampaignRecipient.campaign_id == campaign.id)
        )
    ).scalar_one()
    assert recipient.status == CampaignRecipientStatus.SENT.value

    _, kwargs = mock_send.call_args
    assert kwargs["to_address"] == "rahim@example.com"
    assert kwargs["subject"] == "Hi Rahim"
    assert kwargs["body"] == "Hello Rahim!"


async def test_mailchimp_failure_marks_recipient_failed(db_session: AsyncSession) -> None:
    await _set_email_credentials(
        db_session, {"api_key": "md-fake-key", "from_address": "noreply@example.com"}
    )
    customer = await _add_customer(
        db_session, name="A", phone="+8801711000101", email="a@example.com"
    )
    campaign = await _create_resolved_email_campaign(db_session, [customer])

    mock_result = SendEmailResult(success=False, message="invalid-sender")
    with patch(
        "app.tasks.sms_campaigns.mailchimp_send_email", new=AsyncMock(return_value=mock_result)
    ):
        await send_campaign_messages_async(campaign.id, session_factory=TestSessionLocal)

    recipient = (
        await db_session.execute(
            select(CampaignRecipient).where(CampaignRecipient.campaign_id == campaign.id)
        )
    ).scalar_one()
    assert recipient.status == CampaignRecipientStatus.FAILED.value
    assert "invalid-sender" in recipient.failure_reason
