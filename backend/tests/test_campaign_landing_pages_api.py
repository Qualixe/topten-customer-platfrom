"""GET/POST/PATCH /api/v1/sms/campaigns/{id}/landing-page (admin builder)
and GET /api/v1/public/campaign-landing-page/{slug} (public site).
"""

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.campaign import Campaign
from app.models.campaign_landing_page import CampaignLandingPage
from app.models.role import Role
from app.models.user import User


async def _create_campaign(db_session: AsyncSession, *, name: str = "Summer Sale") -> Campaign:
    campaign = Campaign(
        name=name,
        campaign_type="PROFILE_COMPLETION",
        audience_rule_type="GENERAL",
        audience_rule_params={},
        message="Hi",
        sender_id="TopTen",
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)
    return campaign


VALID_BUILDER_DATA = {
    "version": 1,
    "blocks": [
        {"id": "block-1", "type": "heading", "content": {"text": "Complete Your Profile"}},
        {
            "id": "block-2",
            "type": "date_of_birth",
            "content": {"label": "Date of Birth", "required": "true"},
        },
    ],
}


async def test_create_campaign_landing_page(client: AsyncClient, db_session: AsyncSession) -> None:
    """Scenario 14."""
    campaign = await _create_campaign(db_session)

    response = await client.post(
        f"/api/v1/sms/campaigns/{campaign.public_id}/landing-page",
        json={
            "name": "Summer Sale Page",
            "slug": "summer-sale",
            "builder_data": VALID_BUILDER_DATA,
        },
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["slug"] == "summer-sale"
    assert data["published"] is False
    assert len(data["builder_data"]["blocks"]) == 2


async def test_update_campaign_landing_page(client: AsyncClient, db_session: AsyncSession) -> None:
    """Scenario 15."""
    campaign = await _create_campaign(db_session)
    await client.post(
        f"/api/v1/sms/campaigns/{campaign.public_id}/landing-page",
        json={"name": "Draft", "slug": "draft-page", "builder_data": VALID_BUILDER_DATA},
    )

    response = await client.patch(
        f"/api/v1/sms/campaigns/{campaign.public_id}/landing-page",
        json={"published": True, "name": "Published Page"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["published"] is True
    assert data["name"] == "Published Page"
    # Untouched fields (slug, builder_data) survive a partial update.
    assert data["slug"] == "draft-page"


async def test_invalid_builder_block_type_is_rejected(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Scenario 16: an unsupported block type must 422, never save."""
    campaign = await _create_campaign(db_session)

    response = await client.post(
        f"/api/v1/sms/campaigns/{campaign.public_id}/landing-page",
        json={
            "name": "Bad Page",
            "slug": "bad-page",
            "builder_data": {
                "version": 1,
                "blocks": [{"id": "x", "type": "custom_html", "content": {}}],
            },
        },
    )
    assert response.status_code == 422


async def test_invalid_builder_json_shape_is_rejected(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Scenario 17: an unrecognized top-level field in builder_data must
    422 rather than being silently accepted."""
    campaign = await _create_campaign(db_session)

    response = await client.post(
        f"/api/v1/sms/campaigns/{campaign.public_id}/landing-page",
        json={
            "name": "Bad Page",
            "slug": "bad-page-2",
            "builder_data": {"version": 1, "blocks": [], "free_position_layout": True},
        },
    )
    assert response.status_code == 422


async def test_staff_cannot_create_or_update_landing_page_but_can_view(
    unauthenticated_client: AsyncClient, admin_user: User, db_session: AsyncSession
) -> None:
    """Scenario 18: only campaigns.manage can create/edit/publish; view-only
    Staff can still read one that already exists."""
    campaign = await _create_campaign(db_session)
    landing_page = CampaignLandingPage(
        campaign_id=campaign.id,
        name="Existing Page",
        slug="existing-page",
        builder_data=VALID_BUILDER_DATA,
        published=False,
    )
    db_session.add(landing_page)
    await db_session.commit()

    role = (await db_session.execute(select(Role).where(Role.name == "Staff"))).scalar_one()
    staff = User(
        email="staff.landing-page@topten.com.bd",
        hashed_password=hash_password("some-password-123"),
        name="Staff User",
        role_id=role.id,
    )
    db_session.add(staff)
    await db_session.commit()
    await db_session.refresh(staff)
    token = create_access_token(user_public_id=str(staff.public_id))
    headers = {"Authorization": f"Bearer {token}"}

    view_response = await unauthenticated_client.get(
        f"/api/v1/sms/campaigns/{campaign.public_id}/landing-page", headers=headers
    )
    assert view_response.status_code == 200

    create_response = await unauthenticated_client.post(
        f"/api/v1/sms/campaigns/{campaign.public_id}/landing-page",
        headers=headers,
        json={"name": "Nope", "slug": "nope", "builder_data": VALID_BUILDER_DATA},
    )
    assert create_response.status_code == 403

    update_response = await unauthenticated_client.patch(
        f"/api/v1/sms/campaigns/{campaign.public_id}/landing-page",
        headers=headers,
        json={"published": True},
    )
    assert update_response.status_code == 403


async def test_unpublished_landing_page_cannot_be_accessed_publicly(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Scenario 19."""
    campaign = await _create_campaign(db_session)
    landing_page = CampaignLandingPage(
        campaign_id=campaign.id,
        name="Draft Page",
        slug="still-a-draft",
        builder_data=VALID_BUILDER_DATA,
        published=False,
    )
    db_session.add(landing_page)
    await db_session.commit()

    response = await unauthenticated_client.get(
        "/api/v1/public/campaign-landing-page/still-a-draft"
    )
    assert response.status_code == 404


async def test_published_landing_page_is_accessible_publicly(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    campaign = await _create_campaign(db_session)
    landing_page = CampaignLandingPage(
        campaign_id=campaign.id,
        name="Live Page",
        slug="live-page",
        builder_data=VALID_BUILDER_DATA,
        published=True,
    )
    db_session.add(landing_page)
    await db_session.commit()

    response = await unauthenticated_client.get("/api/v1/public/campaign-landing-page/live-page")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["name"] == "Live Page"
    assert len(data["builder_data"]["blocks"]) == 2
    # No campaign id, recipient info, or other internal identifiers leak.
    assert "campaign_id" not in data
    assert "id" not in data
