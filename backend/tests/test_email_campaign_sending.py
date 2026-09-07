"""Exercises `_send_email_campaign` (the EMAIL branch of
`send_campaign_messages_async`) directly against the test database. Never
hits Mailchimp: `create_and_send_campaign` (the aliased import in
`app.tasks.sms_campaigns`) is mocked in every test here — same convention
as test_campaign_sending.py for SMS."""

from unittest.mock import AsyncMock, patch
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import ValidationAppError
from app.models.campaign import Campaign, CampaignStatus
from app.models.campaign_recipient import CampaignRecipient, CampaignRecipientStatus
from app.models.customer import Customer
from app.tasks.sms_campaigns import (
    resolve_campaign_audience_async,
    send_campaign_messages_async,
)
from app.views.mailchimp_marketing import SendCampaignReport, SyncItemResult
from tests.conftest import TestSessionLocal
from tests.support import get_customer_type_id


async def _add_customer(db_session: AsyncSession, *, name: str, email: str) -> Customer:
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


async def _create_resolved_email_campaign(
    db_session: AsyncSession, customers: list[Customer]
) -> Campaign:
    campaign = Campaign(
        name="Test email campaign",
        campaign_type="PROMOTIONAL",
        channel="EMAIL",
        audience_rule_type="SPECIFIC_CUSTOMERS",
        audience_rule_params={"customer_ids": [str(c.public_id) for c in customers]},
        message="<p>Hello!</p>",
        subject="A subject line",
        status=CampaignStatus.SCHEDULED.value,
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)
    await db_session.refresh(campaign)
    return campaign


async def _create_resolved_template_campaign(
    db_session: AsyncSession, customers: list[Customer]
) -> Campaign:
    campaign = Campaign(
        name="Test template campaign",
        campaign_type="PROMOTIONAL",
        channel="EMAIL",
        audience_rule_type="SPECIFIC_CUSTOMERS",
        audience_rule_params={"customer_ids": [str(c.public_id) for c in customers]},
        message="[main]\n<p>Hello!</p>",  # synthesized display string, not sent as-is
        subject="A subject line",
        mailchimp_template_id=42,
        mailchimp_template_sections={"main": "<p>Hello!</p>"},
        status=CampaignStatus.SCHEDULED.value,
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)
    await db_session.refresh(campaign)
    return campaign


async def _recipients(db_session: AsyncSession, campaign_id: int) -> list[CampaignRecipient]:
    rows = (
        await db_session.execute(
            select(CampaignRecipient)
            .where(CampaignRecipient.campaign_id == campaign_id)
            .order_by(CampaignRecipient.id)
        )
    ).scalars().all()
    return list(rows)


async def test_successful_send_marks_recipients_sent_and_campaign_completed(
    db_session: AsyncSession,
) -> None:
    customer = await _add_customer(db_session, name="A", email="a@example.com")
    campaign = await _create_resolved_email_campaign(db_session, [customer])

    mock_report = SendCampaignReport(
        total=1,
        sent=1,
        failed=0,
        items=[
            SyncItemResult(
                customer_id=customer.public_id, email=customer.email, success=True, message="OK"
            )
        ],
        campaign_url="https://mailchimp.com/campaigns/123",
    )
    with patch(
        "app.tasks.sms_campaigns.create_and_send_campaign", new=AsyncMock(return_value=mock_report)
    ) as mock_send:
        await send_campaign_messages_async(campaign.id, session_factory=TestSessionLocal)

    await db_session.refresh(campaign)
    assert campaign.status == CampaignStatus.COMPLETED.value

    recipients = await _recipients(db_session, campaign.id)
    assert recipients[0].status == CampaignRecipientStatus.SENT.value
    assert recipients[0].sent_at is not None

    _, kwargs = mock_send.call_args
    assert kwargs["customer_ids"] == [customer.public_id]
    assert kwargs["subject"] == "A subject line"
    # The raw body is rendered into TopTen's own branded layout before
    # being sent — not passed through to Mailchimp verbatim.
    assert "<p>Hello!</p>" in kwargs["html_body"]
    assert "<!DOCTYPE html>" in kwargs["html_body"]


async def test_partial_failure_marks_only_that_recipient_failed(
    db_session: AsyncSession,
) -> None:
    """Each recipient gets their own `create_and_send_campaign` call (for
    per-recipient personalization) — the mock returns a different report
    depending on which single customer_id it was called with."""
    reached = await _add_customer(db_session, name="Reached", email="reached@example.com")
    skipped = await _add_customer(db_session, name="Skipped", email="skipped@example.com")
    campaign = await _create_resolved_email_campaign(db_session, [reached, skipped])

    def _report_for(*_args, customer_ids, **_kwargs) -> SendCampaignReport:
        customer_id = customer_ids[0]
        if customer_id == reached.public_id:
            return SendCampaignReport(
                total=1,
                sent=1,
                failed=0,
                items=[
                    SyncItemResult(
                        customer_id=reached.public_id,
                        email=reached.email,
                        success=True,
                        message="OK",
                    )
                ],
            )
        return SendCampaignReport(
            total=1,
            sent=0,
            failed=1,
            items=[
                SyncItemResult(
                    customer_id=skipped.public_id,
                    email="",
                    success=False,
                    message="Not eligible — needs marketing opt-in and a saved email address.",
                )
            ],
        )

    with patch(
        "app.tasks.sms_campaigns.create_and_send_campaign",
        new=AsyncMock(side_effect=_report_for),
    ):
        await send_campaign_messages_async(campaign.id, session_factory=TestSessionLocal)

    await db_session.refresh(campaign)
    assert campaign.status == CampaignStatus.COMPLETED.value

    recipients = {r.customer_id: r for r in await _recipients(db_session, campaign.id)}
    assert recipients[reached.id].status == CampaignRecipientStatus.SENT.value
    assert recipients[skipped.id].status == CampaignRecipientStatus.FAILED.value
    assert "opt-in" in recipients[skipped.id].failure_reason


async def test_template_attached_campaign_sends_via_template_not_html(
    db_session: AsyncSession,
) -> None:
    """A campaign with mailchimp_template_id set passes template_id/
    template_sections through to create_and_send_campaign instead of
    html_body — the synthesized `message` column is display-only and
    never sent as the actual content (see CampaignCreate's docstring)."""
    customer = await _add_customer(db_session, name="A", email="a@example.com")
    campaign = await _create_resolved_template_campaign(db_session, [customer])

    mock_report = SendCampaignReport(
        total=1,
        sent=1,
        failed=0,
        items=[
            SyncItemResult(
                customer_id=customer.public_id, email=customer.email, success=True, message="OK"
            )
        ],
        campaign_url="https://mailchimp.com/campaigns/456",
    )
    with patch(
        "app.tasks.sms_campaigns.create_and_send_campaign", new=AsyncMock(return_value=mock_report)
    ) as mock_send:
        await send_campaign_messages_async(campaign.id, session_factory=TestSessionLocal)

    await db_session.refresh(campaign)
    assert campaign.status == CampaignStatus.COMPLETED.value

    recipients = await _recipients(db_session, campaign.id)
    assert recipients[0].status == CampaignRecipientStatus.SENT.value

    _, kwargs = mock_send.call_args
    assert kwargs["html_body"] is None
    assert kwargs["template_id"] == 42
    assert kwargs["template_sections"] == {"main": "<p>Hello!</p>"}


async def test_credentials_failure_fails_campaign_and_leaves_recipients_pending(
    db_session: AsyncSession,
) -> None:
    customer = await _add_customer(db_session, name="A", email="a@example.com")
    campaign = await _create_resolved_email_campaign(db_session, [customer])

    with patch(
        "app.tasks.sms_campaigns.create_and_send_campaign",
        new=AsyncMock(side_effect=ValidationAppError("Save Mailchimp credentials first.")),
    ):
        await send_campaign_messages_async(campaign.id, session_factory=TestSessionLocal)

    await db_session.refresh(campaign)
    assert campaign.status == CampaignStatus.FAILED.value

    recipients = await _recipients(db_session, campaign.id)
    assert recipients[0].status == CampaignRecipientStatus.PENDING.value
