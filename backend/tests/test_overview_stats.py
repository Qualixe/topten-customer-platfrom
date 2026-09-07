"""Reports page overview-stats endpoints:
`GET /sms/campaigns/overview-stats` and `GET /mailchimp/email-stats`.
Builds real Campaign/CampaignRecipient rows through the same
resolve-then-send pipeline the SMS/email sending tests use, then checks the
aggregate matches — never a hand-rolled count."""

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import merge_credential_data
from app.common.sms_gateway_client import SendSmsResult
from app.models.campaign import Campaign, CampaignStatus
from app.models.customer import Customer
from app.services.mailchimp_sync import MAILCHIMP_PROVIDER
from app.services.sms_campaigns import SMS_GATEWAY_PROVIDER
from app.tasks.sms_campaigns import resolve_campaign_audience_async, send_campaign_messages_async
from app.views.mailchimp_marketing import SendCampaignReport, SyncItemResult
from tests.conftest import TestSessionLocal
from tests.support import get_customer_type_id


async def _add_customer(
    db_session: AsyncSession, *, name: str, phone: str, email: str | None = None
) -> Customer:
    customer = Customer(
        name=name,
        phone=phone,
        normalized_phone=phone,
        email=email,
        customer_type_id=await get_customer_type_id(db_session),
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def _create_resolved_campaign(
    db_session: AsyncSession, customers: list[Customer], *, channel: str, **extra
) -> Campaign:
    campaign = Campaign(
        name=f"Test {channel} campaign",
        campaign_type="PROMOTIONAL",
        channel=channel,
        audience_rule_type="SPECIFIC_CUSTOMERS",
        audience_rule_params={"customer_ids": [str(c.public_id) for c in customers]},
        status=CampaignStatus.SCHEDULED.value,
        **extra,
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)
    await db_session.refresh(campaign)
    return campaign


# --- SMS ------------------------------------------------------------------


async def test_sms_overview_stats_counts_sent_and_failed(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    async with TestSessionLocal() as session:
        await merge_credential_data(
            session,
            SMS_GATEWAY_PROVIDER,
            {"api_url": "https://example.com/api/smsapi", "api_key": "key", "sender_id": "X"},
        )

    ok_customer = await _add_customer(db_session, name="A", phone="+8801711000301")
    ok_campaign = await _create_resolved_campaign(
        db_session, [ok_customer], channel="SMS", message="Hello!", sender_id="TOPTEN"
    )
    bad_customer = await _add_customer(db_session, name="B", phone="+8801711000302")
    bad_campaign = await _create_resolved_campaign(
        db_session, [bad_customer], channel="SMS", message="Hello!", sender_id="TOPTEN"
    )

    with patch(
        "app.tasks.sms_campaigns.gateway_send_sms",
        new=AsyncMock(return_value=SendSmsResult(success=True, http_status=200, message="OK")),
    ):
        await send_campaign_messages_async(ok_campaign.id, session_factory=TestSessionLocal)
    with patch(
        "app.tasks.sms_campaigns.gateway_send_sms",
        new=AsyncMock(return_value=SendSmsResult(success=False, http_status=500, message="down")),
    ):
        await send_campaign_messages_async(bad_campaign.id, session_factory=TestSessionLocal)

    response = await client.get("/api/v1/sms/campaigns/overview-stats")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total_campaigns"] == 2
    assert data["total_recipients"] == 2
    assert data["sent"] == 1
    assert data["failed"] == 1


async def test_sms_overview_stats_with_no_campaigns_is_all_zero(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    response = await client.get("/api/v1/sms/campaigns/overview-stats")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data == {"total_campaigns": 0, "total_recipients": 0, "sent": 0, "failed": 0}


# --- Email ------------------------------------------------------------------


async def test_email_stats_counts_sent_and_failed_from_local_rows(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer_ok = await _add_customer(
        db_session, name="A", phone="+8801711000303", email="a@example.com"
    )
    customer_bad = await _add_customer(
        db_session, name="B", phone="+8801711000304", email="b@example.com"
    )
    campaign = await _create_resolved_campaign(
        db_session,
        [customer_ok, customer_bad],
        channel="EMAIL",
        message="<p>Hi</p>",
        subject="Subject",
    )

    # Each recipient gets its own `create_and_send_campaign` call (for
    # per-recipient personalization) — the mock returns a different report
    # depending on which single customer_id it was called with.
    def _report_for(*_args, customer_ids, **_kwargs) -> SendCampaignReport:
        customer_id = customer_ids[0]
        if customer_id == customer_ok.public_id:
            return SendCampaignReport(
                total=1,
                sent=1,
                failed=0,
                items=[
                    SyncItemResult(
                        customer_id=customer_ok.public_id,
                        email="a@example.com",
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
                    customer_id=customer_bad.public_id,
                    email="b@example.com",
                    success=False,
                    message="bounced",
                )
            ],
        )

    with patch(
        "app.tasks.sms_campaigns.create_and_send_campaign",
        new=AsyncMock(side_effect=_report_for),
    ):
        await send_campaign_messages_async(campaign.id, session_factory=TestSessionLocal)

    # No Mailchimp credentials saved — `opened` should degrade to 0 rather
    # than error, since there's nothing to call live for it.
    response = await client.get("/api/v1/mailchimp/email-stats")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total_campaigns"] == 1
    assert data["sent"] == 1
    assert data["failed"] == 1
    assert data["opened"] == 0


async def test_email_stats_opens_come_from_live_mailchimp_reports(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    from app.common.mailchimp_client import ReportsSummaryResult

    async with TestSessionLocal() as session:
        await merge_credential_data(session, MAILCHIMP_PROVIDER, {"api_key": "fake-key-us21"})

    with patch(
        "app.services.mailchimp_sync.get_reports_summary",
        new=AsyncMock(
            return_value=ReportsSummaryResult(
                success=True, message="ok", total_campaigns=3, emails_sent=30, opens=12, failed=2
            )
        ),
    ):
        response = await client.get("/api/v1/mailchimp/email-stats")

    assert response.status_code == 200
    assert response.json()["data"]["opened"] == 12


async def test_email_stats_with_no_campaigns_is_all_zero(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    response = await client.get("/api/v1/mailchimp/email-stats")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data == {"total_campaigns": 0, "sent": 0, "opened": 0, "failed": 0}
