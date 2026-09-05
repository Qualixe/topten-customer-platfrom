"""Mailchimp Marketing sync endpoints: consent gating, per-customer
success/failure reporting, and permission enforcement for
marketing.view/marketing.manage. Mirrors test_sendgrid_sync_api.py's sync
coverage — Mailchimp has no campaign-sending flow to mirror alongside it.
"""

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import merge_credential_data
from app.common.mailchimp_client import ListResult, UpsertResult
from app.core.security import create_access_token, hash_password
from app.models.customer import Customer
from app.models.role import Role
from app.models.user import User
from app.services.mailchimp_sync import MAILCHIMP_PROVIDER
from scripts.seed_auth import seed_auth
from tests.conftest import TestSessionLocal
from tests.support import get_customer_type_id

CREDENTIALS = {"api_key": "fake-key-us21", "list_id": "abc123"}


async def _set_credentials() -> None:
    async with TestSessionLocal() as session:
        await merge_credential_data(session, MAILCHIMP_PROVIDER, CREDENTIALS)


async def _add_customer(
    db_session: AsyncSession, *, name: str, phone: str, email: str | None, opted_in: bool
) -> Customer:
    customer = Customer(
        name=name,
        phone=phone,
        normalized_phone=phone,
        email=email,
        marketing_opt_in=opted_in,
        customer_type_id=await get_customer_type_id(db_session),
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


def _patch_list():
    return patch(
        "app.services.mailchimp_sync.verify_list",
        new=AsyncMock(
            return_value=ListResult(
                success=True, message="found", list_id="abc123", list_name="TopTen Customers"
            )
        ),
    )


# --- Opt-in gating & per-customer reporting ---------------------------------


async def test_opted_out_customer_is_never_synced(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _set_credentials()
    opted_in = await _add_customer(
        db_session, name="In", phone="+8801711000201", email="in@example.com", opted_in=True
    )
    opted_out = await _add_customer(
        db_session, name="Out", phone="+8801711000202", email="out@example.com", opted_in=False
    )

    with (
        _patch_list(),
        patch(
            "app.services.mailchimp_sync.upsert_member",
            new=AsyncMock(return_value=UpsertResult(success=True, message="synced")),
        ) as mock_upsert,
    ):
        response = await client.post(
            "/api/v1/mailchimp/sync",
            json={"customer_ids": [str(opted_in.public_id), str(opted_out.public_id)]},
        )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 2
    assert data["synced"] == 1
    assert data["failed"] == 1
    assert mock_upsert.await_count == 1
    _, kwargs = mock_upsert.call_args
    assert kwargs["email"] == "in@example.com"

    items_by_id = {item["customer_id"]: item for item in data["items"]}
    assert items_by_id[str(opted_in.public_id)]["success"] is True
    assert items_by_id[str(opted_out.public_id)]["success"] is False
    assert "opt-in" in items_by_id[str(opted_out.public_id)]["message"]

    await db_session.refresh(opted_in)
    await db_session.refresh(opted_out)
    assert opted_in.mailchimp_synced_at is not None
    assert opted_out.mailchimp_synced_at is None


async def test_per_customer_failure_is_reported(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _set_credentials()
    customer = await _add_customer(
        db_session, name="Rahim", phone="+8801711000203", email="rahim@example.com", opted_in=True
    )

    with (
        _patch_list(),
        patch(
            "app.services.mailchimp_sync.upsert_member",
            new=AsyncMock(return_value=UpsertResult(success=False, message="Invalid email")),
        ),
    ):
        response = await client.post(
            "/api/v1/mailchimp/sync", json={"customer_ids": [str(customer.public_id)]}
        )

    data = response.json()["data"]
    assert data["failed"] == 1
    assert data["items"][0]["message"] == "Invalid email"


async def test_sync_without_credentials_is_a_clean_error(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(
        db_session, name="Rahim", phone="+8801711000204", email="rahim@example.com", opted_in=True
    )
    response = await client.post(
        "/api/v1/mailchimp/sync", json={"customer_ids": [str(customer.public_id)]}
    )
    assert response.status_code == 422


async def test_sync_reports_a_clean_error_when_list_is_unreachable(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _set_credentials()
    customer = await _add_customer(
        db_session, name="Rahim", phone="+8801711000205", email="rahim@example.com", opted_in=True
    )

    with patch(
        "app.services.mailchimp_sync.verify_list",
        new=AsyncMock(return_value=ListResult(success=False, message="Invalid API key")),
    ):
        response = await client.post(
            "/api/v1/mailchimp/sync", json={"customer_ids": [str(customer.public_id)]}
        )

    assert response.status_code == 422


# --- Credentials status --------------------------------------------------------


async def test_credentials_status_reports_invalid_when_nothing_saved(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    response = await client.get("/api/v1/mailchimp/credentials")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["list_valid"] is False
    assert data["list_name"] is None
    assert data["api_key"]["is_set"] is False


async def test_credentials_status_reports_valid_list(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _set_credentials()
    with _patch_list():
        response = await client.get("/api/v1/mailchimp/credentials")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["list_valid"] is True
    assert data["list_name"] == "TopTen Customers"
    assert data["api_key"]["is_set"] is True


async def test_update_credentials_persists(client: AsyncClient, db_session: AsyncSession) -> None:
    response = await client.put(
        "/api/v1/mailchimp/credentials",
        json={"api_key": "new-key-us5", "list_id": "xyz789"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["list_id"]["value"] == "xyz789"


# --- Permission enforcement ---------------------------------------------------


async def _get_role(db_session: AsyncSession, name: str) -> Role:
    from sqlalchemy import select

    return (await db_session.execute(select(Role).where(Role.name == name))).scalar_one()


async def _staff_headers(db_session: AsyncSession) -> dict:
    await seed_auth(session_factory=TestSessionLocal)
    role = await _get_role(db_session, "Staff")
    user = User(
        email="mailchimp-staff@topten.com.bd",
        hashed_password=hash_password("some-password-123"),
        name="Staff User",
        role_id=role.id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token = create_access_token(user_public_id=str(user.public_id))
    return {"Authorization": f"Bearer {token}"}


async def test_staff_cannot_trigger_sync(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await _staff_headers(db_session)
    customer = await _add_customer(
        db_session, name="Rahim", phone="+8801711000206", email="rahim@example.com", opted_in=True
    )
    response = await unauthenticated_client.post(
        "/api/v1/mailchimp/sync",
        headers=headers,
        json={"customer_ids": [str(customer.public_id)]},
    )
    assert response.status_code == 403


async def test_staff_cannot_view_credentials(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await _staff_headers(db_session)
    response = await unauthenticated_client.get(
        "/api/v1/mailchimp/credentials", headers=headers
    )
    assert response.status_code == 403
