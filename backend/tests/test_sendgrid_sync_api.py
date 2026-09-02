"""SendGrid Marketing sync/campaign endpoints: consent gating, per-customer
success/failure reporting, the draft-then-send two-step, and permission
enforcement for marketing.view/marketing.manage."""

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import merge_credential_data
from app.common.sendgrid_client import (
    ActionResult,
    CampaignResult,
    ListResult,
    SenderResult,
    SuppressionResult,
    UpsertResult,
)
from app.core.security import create_access_token, hash_password
from app.models.customer import Customer
from app.models.role import Role
from app.models.sendgrid_campaign import SendGridCampaign
from app.models.user import User
from app.services.sendgrid_sync import SENDGRID_PROVIDER
from scripts.seed_auth import seed_auth
from tests.conftest import TestSessionLocal

CREDENTIALS = {
    "api_key": "SG.fake-key",
    "list_name": "TopTen Customers",
    "from_name": "TopTen",
    "from_email": "noreply@topten.example",
    "reply_to_email": "noreply@topten.example",
}


async def _set_credentials() -> None:
    async with TestSessionLocal() as session:
        await merge_credential_data(session, SENDGRID_PROVIDER, CREDENTIALS)


async def _add_customer(
    db_session: AsyncSession, *, name: str, phone: str, email: str | None, opted_in: bool
) -> Customer:
    customer = Customer(
        name=name,
        phone=phone,
        normalized_phone=phone,
        email=email,
        marketing_opt_in=opted_in,
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


def _patch_list():
    return patch(
        "app.services.sendgrid_sync.find_or_create_list",
        new=AsyncMock(return_value=ListResult(success=True, message="found", list_id="list-1")),
    )


def _patch_sender():
    return patch(
        "app.services.sendgrid_sync.find_verified_sender",
        new=AsyncMock(
            return_value=SenderResult(success=True, message="found", sender_id=5, verified=True)
        ),
    )


def _patch_suppression_group():
    return patch(
        "app.services.sendgrid_sync.find_or_create_suppression_group",
        new=AsyncMock(
            return_value=SuppressionResult(success=True, message="found", group_id=42)
        ),
    )


# --- Opt-in gating & per-customer reporting ---------------------------------


async def test_opted_out_customer_is_never_synced(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _set_credentials()
    opted_in = await _add_customer(
        db_session, name="In", phone="+8801711000101", email="in@example.com", opted_in=True
    )
    opted_out = await _add_customer(
        db_session, name="Out", phone="+8801711000102", email="out@example.com", opted_in=False
    )

    with (
        _patch_list(),
        patch(
            "app.services.sendgrid_sync.upsert_contact",
            new=AsyncMock(return_value=UpsertResult(success=True, message="synced")),
        ) as mock_upsert,
    ):
        response = await client.post(
            "/api/v1/sendgrid/sync",
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
    assert opted_in.marketing_synced_at is not None
    assert opted_out.marketing_synced_at is None


async def test_per_customer_failure_is_reported(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _set_credentials()
    customer = await _add_customer(
        db_session, name="Rahim", phone="+8801711000104", email="rahim@example.com", opted_in=True
    )

    with (
        _patch_list(),
        patch(
            "app.services.sendgrid_sync.upsert_contact",
            new=AsyncMock(return_value=UpsertResult(success=False, message="Invalid email")),
        ),
    ):
        response = await client.post(
            "/api/v1/sendgrid/sync", json={"customer_ids": [str(customer.public_id)]}
        )

    data = response.json()["data"]
    assert data["failed"] == 1
    assert data["items"][0]["message"] == "Invalid email"


async def test_sync_without_credentials_is_a_clean_error(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(
        db_session, name="Rahim", phone="+8801711000105", email="rahim@example.com", opted_in=True
    )
    response = await client.post(
        "/api/v1/sendgrid/sync", json={"customer_ids": [str(customer.public_id)]}
    )
    assert response.status_code == 422


# --- Draft-then-send two-step -----------------------------------------------


async def test_create_campaign_draft_then_send(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _set_credentials()
    customer = await _add_customer(
        db_session, name="Rahim", phone="+8801711000106", email="rahim@example.com", opted_in=True
    )
    customer.marketing_synced_at = customer.created_at
    await db_session.commit()

    with (
        _patch_list(),
        _patch_sender(),
        _patch_suppression_group(),
        patch(
            "app.services.sendgrid_sync.upsert_contact",
            new=AsyncMock(return_value=UpsertResult(success=True, message="synced")),
        ),
        patch(
            "app.services.sendgrid_sync.create_single_send",
            new=AsyncMock(
                return_value=CampaignResult(success=True, message="created", campaign_id="camp-1")
            ),
        ),
    ):
        create_response = await client.post(
            "/api/v1/sendgrid/campaigns",
            json={
                "customer_ids": [str(customer.public_id)],
                "subject": "This month's promo",
                "html_body": "<p>Hello!</p>",
            },
        )

    assert create_response.status_code == 200
    created = create_response.json()["data"]
    assert created["status"] == "DRAFT"
    assert created["recipient_count"] == 1
    campaign_id = created["id"]

    row = (
        await db_session.execute(
            select(SendGridCampaign).where(SendGridCampaign.public_id == campaign_id)
        )
    ).scalar_one()
    assert row.sendgrid_campaign_id == "camp-1"

    with patch(
        "app.services.sendgrid_sync.sendgrid_schedule_now",
        new=AsyncMock(return_value=ActionResult(success=True, message="sent")),
    ):
        send_response = await client.post(f"/api/v1/sendgrid/campaigns/{campaign_id}/send")

    assert send_response.status_code == 200
    assert send_response.json()["data"]["status"] == "SENT"


async def test_cannot_send_an_already_sent_campaign_twice(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _set_credentials()
    row = SendGridCampaign(
        sendgrid_campaign_id="camp-2",
        subject="Already sent",
        html_body="<p>hi</p>",
        recipient_count=1,
        status="SENT",
    )
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)

    response = await client.post(f"/api/v1/sendgrid/campaigns/{row.public_id}/send")
    assert response.status_code == 422


async def test_campaign_draft_requires_synced_customers(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _set_credentials()
    # Opted in but never synced yet.
    customer = await _add_customer(
        db_session, name="Rahim", phone="+8801711000107", email="rahim@example.com", opted_in=True
    )

    with _patch_sender(), _patch_suppression_group():
        response = await client.post(
            "/api/v1/sendgrid/campaigns",
            json={
                "customer_ids": [str(customer.public_id)],
                "subject": "Promo",
                "html_body": "<p>hi</p>",
            },
        )

    assert response.status_code == 422


async def test_campaign_draft_requires_a_verified_sender(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Sender verification is an external SendGrid-side step now (no
    address/nickname collected here) — if nothing in the account matches
    the configured from_email yet, that's a clear, actionable error."""
    await _set_credentials()
    customer = await _add_customer(
        db_session, name="Rahim", phone="+8801711000109", email="rahim@example.com", opted_in=True
    )
    customer.marketing_synced_at = customer.created_at
    await db_session.commit()

    with patch(
        "app.services.sendgrid_sync.find_verified_sender",
        new=AsyncMock(
            return_value=SenderResult(success=True, message="not found", sender_id=None)
        ),
    ):
        response = await client.post(
            "/api/v1/sendgrid/campaigns",
            json={
                "customer_ids": [str(customer.public_id)],
                "subject": "Promo",
                "html_body": "<p>hi</p>",
            },
        )

    assert response.status_code == 422
    assert "verified sender" in response.json()["detail"].lower()


# --- Credentials status --------------------------------------------------------


async def test_credentials_status_reports_unverified_sender_when_nothing_saved(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    response = await client.get("/api/v1/sendgrid/credentials")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["sender_verified"] is False
    assert "sender_nickname" not in data
    assert "company" not in data


async def test_credentials_status_reports_verified_sender(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _set_credentials()
    with patch(
        "app.services.sendgrid_sync.find_verified_sender",
        new=AsyncMock(
            return_value=SenderResult(success=True, message="found", sender_id=5, verified=True)
        ),
    ):
        response = await client.get("/api/v1/sendgrid/credentials")

    assert response.status_code == 200
    assert response.json()["data"]["sender_verified"] is True


# --- Permission enforcement ---------------------------------------------------


async def _get_role(db_session: AsyncSession, name: str) -> Role:
    return (await db_session.execute(select(Role).where(Role.name == name))).scalar_one()


async def _staff_headers(db_session: AsyncSession) -> dict:
    await seed_auth(session_factory=TestSessionLocal)
    role = await _get_role(db_session, "Staff")
    user = User(
        email="staff@topten.com.bd",
        hashed_password=hash_password("some-password-123"),
        name="Staff User",
        role_id=role.id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token = create_access_token(user_public_id=str(user.public_id))
    return {"Authorization": f"Bearer {token}"}


async def test_staff_can_view_campaigns(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await _staff_headers(db_session)
    response = await unauthenticated_client.get("/api/v1/sendgrid/campaigns", headers=headers)
    assert response.status_code == 200


async def test_staff_cannot_trigger_sync(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await _staff_headers(db_session)
    customer = await _add_customer(
        db_session, name="Rahim", phone="+8801711000108", email="rahim@example.com", opted_in=True
    )
    response = await unauthenticated_client.post(
        "/api/v1/sendgrid/sync",
        headers=headers,
        json={"customer_ids": [str(customer.public_id)]},
    )
    assert response.status_code == 403
