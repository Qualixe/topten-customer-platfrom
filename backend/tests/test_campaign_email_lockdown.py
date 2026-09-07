"""An EMAIL campaign's configuration (name, audience rule, campaign type,
recipient snapshot, landing-page config) is system-controlled — an admin
can only ever change its email subject/body via `PATCH /sms/campaigns/{id}`.
SMS campaigns are unaffected by this lockdown (not covered here — see
test_sms_campaigns_api.py for that unrestricted behavior, still intact)."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign, CampaignStatus


@pytest.fixture(autouse=True)
def _patch_celery_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.controllers.sms_campaigns.resolve_campaign_audience.delay",
        lambda campaign_id: None,
    )


async def _create_email_campaign(
    db_session: AsyncSession, *, status: str = CampaignStatus.DRAFT.value
) -> Campaign:
    campaign = Campaign(
        name="Welcome Back",
        campaign_type="PROMOTIONAL",
        channel="EMAIL",
        audience_rule_type="GENERAL",
        audience_rule_params={},
        message="<p>Hello!</p>",
        subject="A subject line",
        status=status,
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)
    return campaign


async def _create_sms_campaign(db_session: AsyncSession) -> Campaign:
    campaign = Campaign(
        name="Eid Promo",
        campaign_type="PROMOTIONAL",
        channel="SMS",
        audience_rule_type="GENERAL",
        audience_rule_params={},
        message="Hello there!",
        sender_id="TopTen",
        status=CampaignStatus.DRAFT.value,
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)
    return campaign


@pytest.mark.parametrize(
    "field,value",
    [
        ("name", "Renamed Campaign"),
        ("sender_id", "SomeSender"),
        ("scheduled_at", "2030-01-01T00:00:00Z"),
        ("status", "CANCELLED"),
    ],
)
async def test_admin_cannot_edit_protected_email_campaign_fields(
    client: AsyncClient, db_session: AsyncSession, field: str, value: str
) -> None:
    campaign = await _create_email_campaign(db_session)

    response = await client.patch(
        f"/api/v1/sms/campaigns/{campaign.public_id}", json={field: value}
    )

    assert response.status_code == 422
    await db_session.refresh(campaign)
    # Nothing changed — the rejected request never touched the row.
    assert campaign.name == "Welcome Back"
    assert campaign.status == CampaignStatus.DRAFT.value


async def test_admin_can_save_email_body_and_subject(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    campaign = await _create_email_campaign(db_session)

    response = await client.patch(
        f"/api/v1/sms/campaigns/{campaign.public_id}",
        json={"message": "<p>New body {{customer_name}}</p>", "subject": "New subject"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["message"] == "<p>New body {{customer_name}}</p>"
    assert data["subject"] == "New subject"
    # Untouched — the endpoint only ever applied the two allowed fields.
    assert data["name"] == "Welcome Back"


async def test_admin_cannot_edit_email_body_once_sent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    campaign = await _create_email_campaign(db_session, status=CampaignStatus.COMPLETED.value)

    response = await client.patch(
        f"/api/v1/sms/campaigns/{campaign.public_id}", json={"message": "<p>Too late</p>"}
    )

    assert response.status_code == 422


async def test_sms_campaign_name_and_sender_id_remain_editable(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """The lockdown is EMAIL-only — SMS campaigns keep their existing
    editable behavior."""
    campaign = await _create_sms_campaign(db_session)

    response = await client.patch(
        f"/api/v1/sms/campaigns/{campaign.public_id}",
        json={"name": "Renamed SMS Campaign", "sender_id": "NewSender"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["name"] == "Renamed SMS Campaign"
    assert data["sender_id"] == "NewSender"


async def test_admin_cannot_attach_landing_page_to_email_campaign(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    campaign = await _create_email_campaign(db_session)

    response = await client.post(
        f"/api/v1/sms/campaigns/{campaign.public_id}/landing-page",
        json={"name": "Landing", "slug": "welcome-back", "builder_data": {"blocks": []}},
    )

    assert response.status_code == 422
