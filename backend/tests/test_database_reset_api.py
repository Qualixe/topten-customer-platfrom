"""POST /api/v1/settings/database/reset — permission gate, the confirmation
phrase, and that the reset actually wipes business data while leaving
auth/settings/credentials untouched, with a real pg_dump backup first.
"""

from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import merge_credential_data
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.models.campaign import Campaign
from app.models.customer import Customer
from app.models.integration_credential import IntegrationCredential
from app.models.role import Role
from app.models.user import User
from scripts.seed_auth import seed_auth
from tests.conftest import TestSessionLocal


@pytest.fixture(autouse=True)
def _backup_to_tmp_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Points backups at a pytest tmp_path instead of the real
    backend/var/backups directory, so running this suite never leaves test
    dump files behind in the repo."""
    monkeypatch.setattr(settings, "BACKUP_DIR", str(tmp_path))


async def _get_role(db_session: AsyncSession, name: str) -> Role:
    return (await db_session.execute(select(Role).where(Role.name == name))).scalar_one()


async def _manager_headers(db_session: AsyncSession) -> dict:
    await seed_auth(session_factory=TestSessionLocal)
    role = await _get_role(db_session, "Manager")
    user = User(
        email="manager@topten.com.bd",
        hashed_password=hash_password("some-password-123"),
        name="Manager",
        role_id=role.id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token = create_access_token(user_public_id=str(user.public_id))
    return {"Authorization": f"Bearer {token}"}


async def _add_customer(db_session: AsyncSession, *, name: str, phone: str) -> Customer:
    customer = Customer(name=name, phone=phone, normalized_phone=phone)
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def test_manager_cannot_reset_database(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Manager gets every other operational permission but not this one —
    it's Admin-only, unlike the rest of the settings tab."""
    headers = await _manager_headers(db_session)
    response = await unauthenticated_client.post(
        "/api/v1/settings/database/reset", headers=headers, json={"confirm": "RESET"}
    )
    assert response.status_code == 403


async def test_requires_authentication(unauthenticated_client: AsyncClient) -> None:
    response = await unauthenticated_client.post(
        "/api/v1/settings/database/reset", json={"confirm": "RESET"}
    )
    assert response.status_code == 401


async def test_wrong_confirmation_phrase_is_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/settings/database/reset", json={"confirm": "reset"}
    )
    assert response.status_code == 422


async def test_missing_confirmation_is_rejected(client: AsyncClient) -> None:
    response = await client.post("/api/v1/settings/database/reset", json={})
    assert response.status_code == 422


async def test_reset_wipes_business_data_keeps_auth_and_settings(
    client: AsyncClient, db_session: AsyncSession, tmp_path: Path
) -> None:
    await _add_customer(db_session, name="Rahim", phone="+8801711000101")
    campaign = Campaign(
        name="Test campaign",
        campaign_type="PROMOTIONAL",
        audience_rule_type="GENERAL",
        audience_rule_params={},
        message="Hi",
        sender_id="TOPTEN",
        status="DRAFT",
    )
    db_session.add(campaign)
    await merge_credential_data(db_session, "sms_gateway", {"api_key": "keep-me"})
    await db_session.commit()

    response = await client.post(
        "/api/v1/settings/database/reset", json={"confirm": "RESET"}
    )
    assert response.status_code == 200
    body = response.json()["data"]
    assert body["backup_file"].startswith("pre-reset-")

    backup_path = tmp_path / body["backup_file"]
    assert backup_path.exists()
    assert backup_path.stat().st_size > 0

    remaining_customers = (await db_session.execute(select(Customer))).scalars().all()
    assert remaining_customers == []
    remaining_campaigns = (await db_session.execute(select(Campaign))).scalars().all()
    assert remaining_campaigns == []

    # Auth and integration credentials survive — the admin making this
    # request is still logged in and configured afterward.
    users = (await db_session.execute(select(User))).scalars().all()
    assert len(users) >= 1
    credential = (
        await db_session.execute(
            select(IntegrationCredential).where(IntegrationCredential.provider == "sms_gateway")
        )
    ).scalar_one()
    assert credential.data.get("api_key") == "keep-me"
