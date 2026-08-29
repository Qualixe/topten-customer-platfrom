"""Confirms the permission table actually gates the customers/campaigns/
imports/couriers/settings endpoints, not just the users/roles endpoints
covered by test_users_api.py."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.campaign import Campaign
from app.models.customer import Customer
from app.models.role import Role
from app.models.user import User
from scripts.seed_auth import seed_auth
from tests.conftest import TestSessionLocal


async def _get_role(db_session: AsyncSession, name: str) -> Role:
    return (await db_session.execute(select(Role).where(Role.name == name))).scalar_one()


async def _create_user(db_session: AsyncSession, *, email: str, role_name: str) -> User:
    await seed_auth(session_factory=TestSessionLocal)
    role = await _get_role(db_session, role_name)
    user = User(
        email=email,
        hashed_password=hash_password("some-password-123"),
        name="Test User",
        role_id=role.id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture(autouse=True)
def _patch_celery_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.controllers.sms_campaigns.resolve_campaign_audience.delay",
        lambda campaign_id: None,
    )


async def _staff_headers(db_session: AsyncSession) -> dict:
    staff = await _create_user(db_session, email="staff@topten.com.bd", role_name="Staff")
    token = create_access_token(user_public_id=str(staff.public_id))
    return {"Authorization": f"Bearer {token}"}


async def _manager_headers(db_session: AsyncSession) -> dict:
    manager = await _create_user(db_session, email="manager@topten.com.bd", role_name="Manager")
    token = create_access_token(user_public_id=str(manager.public_id))
    return {"Authorization": f"Bearer {token}"}


# --- customers: Staff has customers.view only ---


async def test_staff_can_list_customers(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await _staff_headers(db_session)
    response = await unauthenticated_client.get("/api/v1/customers", headers=headers)
    assert response.status_code == 200


async def test_staff_cannot_create_customer(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await _staff_headers(db_session)
    response = await unauthenticated_client.post(
        "/api/v1/customers",
        headers=headers,
        json={"name": "New Customer", "phone": "01711000101"},
    )
    assert response.status_code == 403


async def test_staff_cannot_update_customer(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = Customer(name="Existing", phone="01711000102", normalized_phone="+8801711000102")
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)

    headers = await _staff_headers(db_session)
    response = await unauthenticated_client.patch(
        f"/api/v1/customers/{customer.public_id}", headers=headers, json={"name": "Renamed"}
    )
    assert response.status_code == 403


async def test_staff_cannot_delete_customer(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = Customer(name="Existing", phone="01711000103", normalized_phone="+8801711000103")
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)

    headers = await _staff_headers(db_session)
    response = await unauthenticated_client.delete(
        f"/api/v1/customers/{customer.public_id}", headers=headers
    )
    assert response.status_code == 403


# --- campaigns: Staff has campaigns.view only ---


async def test_staff_can_list_campaigns(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await _staff_headers(db_session)
    response = await unauthenticated_client.get("/api/v1/sms/campaigns", headers=headers)
    assert response.status_code == 200


async def test_staff_cannot_create_campaign(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await _staff_headers(db_session)
    response = await unauthenticated_client.post(
        "/api/v1/sms/campaigns",
        headers=headers,
        json={
            "name": "Eid Promo",
            "campaign_type": "PROMOTIONAL",
            "audience_rule": {"rule_type": "GENERAL"},
            "message": "Hello!",
            "sender_id": "TopTen",
        },
    )
    assert response.status_code == 403


async def test_staff_cannot_delete_campaign(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    campaign = Campaign(
        name="Test",
        campaign_type="PROMOTIONAL",
        audience_rule_type="GENERAL",
        audience_rule_params={},
        message="hi",
        sender_id="TopTen",
        sms_segments=1,
        status="DRAFT",
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    headers = await _staff_headers(db_session)
    response = await unauthenticated_client.delete(
        f"/api/v1/sms/campaigns/{campaign.public_id}", headers=headers
    )
    assert response.status_code == 403


async def test_staff_cannot_see_audience_counts(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Audience counts/preview are part of the campaign-creation flow, so
    they require campaigns.manage, not just campaigns.view."""
    headers = await _staff_headers(db_session)
    response = await unauthenticated_client.get(
        "/api/v1/sms/campaigns/audience-counts", headers=headers
    )
    assert response.status_code == 403


# --- imports/couriers/settings: Staff has none of these permissions ---


async def test_staff_cannot_list_imports(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await _staff_headers(db_session)
    response = await unauthenticated_client.get("/api/v1/imports", headers=headers)
    assert response.status_code == 403


async def test_staff_cannot_view_courier_credentials(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await _staff_headers(db_session)
    response = await unauthenticated_client.get(
        "/api/v1/couriers/pathao/credentials", headers=headers
    )
    assert response.status_code == 403


async def test_staff_cannot_view_sms_gateway_credentials(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await _staff_headers(db_session)
    response = await unauthenticated_client.get(
        "/api/v1/notifications/sms-gateway/credentials", headers=headers
    )
    assert response.status_code == 403


async def test_staff_cannot_upload_site_logo(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await _staff_headers(db_session)
    response = await unauthenticated_client.put(
        "/api/v1/settings/logo",
        headers=headers,
        files={"file": ("logo.png", b"not-a-real-image", "image/png")},
    )
    assert response.status_code == 403


async def test_staff_can_still_view_site_logo(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    """The logo is basic UI chrome shown on every page, logged in or not
    (see /api/v1/public/site-logo) — not a settings-management action."""
    headers = await _staff_headers(db_session)
    response = await unauthenticated_client.get("/api/v1/public/site-logo", headers=headers)
    assert response.status_code == 200


# --- Manager: everything except users.manage ---


async def test_manager_can_create_customer(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await _manager_headers(db_session)
    response = await unauthenticated_client.post(
        "/api/v1/customers",
        headers=headers,
        json={"name": "Manager Created", "phone": "01711000104"},
    )
    assert response.status_code == 201


async def test_manager_cannot_manage_users(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await _manager_headers(db_session)
    response = await unauthenticated_client.get("/api/v1/users", headers=headers)
    assert response.status_code == 403
