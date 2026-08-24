"""GET/PATCH /api/v1/public/customer-profile/{token} — the unauthenticated,
token-gated self-service page a customer uses to submit their own DOB,
address, and (optional) email. Also covers POST
/api/v1/customers/{id}/profile-token, the admin action that mints a link.

Must never expose or accept admin-only fields (id, phone, total_spent,
is_vip, status), never create a new customer, and must treat missing/
expired/revoked tokens identically (no existence leak).
"""

from datetime import UTC, date, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.customer_profile_token import CustomerProfileToken


async def _create_customer(client: AsyncClient, **overrides) -> dict:
    payload = {"name": "Rahim Uddin", "phone": "01711000101", **overrides}
    response = await client.post("/api/v1/customers", json=payload)
    assert response.status_code == 201
    return response.json()["data"]


async def _issue_token(client: AsyncClient, customer_id: str) -> str:
    response = await client.post(f"/api/v1/customers/{customer_id}/profile-token")
    assert response.status_code == 201
    return response.json()["data"]["token"]


async def test_issued_token_is_not_the_customer_id(client: AsyncClient) -> None:
    created = await _create_customer(client)
    token = await _issue_token(client, created["id"])
    assert token != created["id"]
    assert len(token) > 20


async def test_valid_token_returns_profile_excluding_admin_fields(client: AsyncClient) -> None:
    created = await _create_customer(client, is_vip=True)
    token = await _issue_token(client, created["id"])

    response = await client.get(f"/api/v1/public/customer-profile/{token}")
    assert response.status_code == 200

    data = response.json()["data"]
    assert data == {
        "name": "Rahim Uddin",
        "date_of_birth": None,
        "address": None,
        "email": None,
    }
    for forbidden_field in ("id", "phone", "is_vip", "status", "total_spent"):
        assert forbidden_field not in data


async def test_invalid_token_returns_generic_404(client: AsyncClient) -> None:
    response = await client.get("/api/v1/public/customer-profile/not-a-real-token")
    assert response.status_code == 404
    assert response.json()["detail"] == "This link is no longer available"


async def test_expired_token_returns_the_same_generic_404(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    created = await _create_customer(client)
    token = await _issue_token(client, created["id"])

    token_row = (
        await db_session.execute(
            select(CustomerProfileToken).where(CustomerProfileToken.token == token)
        )
    ).scalar_one()
    token_row.expires_at = datetime.now(UTC) - timedelta(days=1)
    await db_session.commit()

    response = await client.get(f"/api/v1/public/customer-profile/{token}")
    assert response.status_code == 404
    assert response.json()["detail"] == "This link is no longer available"


async def test_revoked_token_returns_the_same_generic_404(client: AsyncClient) -> None:
    created = await _create_customer(client)
    old_token = await _issue_token(client, created["id"])

    # Issuing a second token revokes the first.
    await _issue_token(client, created["id"])

    response = await client.get(f"/api/v1/public/customer-profile/{old_token}")
    assert response.status_code == 404
    assert response.json()["detail"] == "This link is no longer available"


async def test_existing_data_is_prefilled(client: AsyncClient, db_session: AsyncSession) -> None:
    created = await _create_customer(
        client, address="Dhanmondi, Dhaka", email="rahim@example.com"
    )
    customer = (
        await db_session.execute(select(Customer).where(Customer.public_id == created["id"]))
    ).scalar_one()
    customer.date_of_birth = date(1995, 5, 10)
    await db_session.commit()

    token = await _issue_token(client, created["id"])
    response = await client.get(f"/api/v1/public/customer-profile/{token}")
    data = response.json()["data"]

    assert data["date_of_birth"] == "1995-05-10"
    assert data["address"] == "Dhanmondi, Dhaka"
    assert data["email"] == "rahim@example.com"


async def test_customer_can_submit_dob_address_and_email(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    created = await _create_customer(client)
    token = await _issue_token(client, created["id"])

    response = await client.patch(
        f"/api/v1/public/customer-profile/{token}",
        json={
            "date_of_birth": "1995-05-10",
            "address": "Dhanmondi, Dhaka",
            "email": "rahim@example.com",
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["date_of_birth"] == "1995-05-10"
    assert data["address"] == "Dhanmondi, Dhaka"
    assert data["email"] == "rahim@example.com"

    stored = (
        await db_session.execute(select(Customer).where(Customer.public_id == created["id"]))
    ).scalar_one()
    assert stored.date_of_birth == date(1995, 5, 10)
    assert stored.address == "Dhanmondi, Dhaka"
    assert stored.email == "rahim@example.com"


async def test_email_is_optional(client: AsyncClient) -> None:
    created = await _create_customer(client)
    token = await _issue_token(client, created["id"])

    response = await client.patch(
        f"/api/v1/public/customer-profile/{token}",
        json={"date_of_birth": "1995-05-10", "address": "Dhanmondi, Dhaka"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["email"] is None


async def test_omitted_email_does_not_clear_an_existing_one(client: AsyncClient) -> None:
    created = await _create_customer(client, email="rahim@example.com")
    token = await _issue_token(client, created["id"])

    response = await client.patch(
        f"/api/v1/public/customer-profile/{token}",
        json={"date_of_birth": "1995-05-10", "address": "Dhanmondi, Dhaka"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["email"] == "rahim@example.com"


async def test_invalid_email_is_rejected(client: AsyncClient) -> None:
    created = await _create_customer(client)
    token = await _issue_token(client, created["id"])

    response = await client.patch(
        f"/api/v1/public/customer-profile/{token}",
        json={
            "date_of_birth": "1995-05-10",
            "address": "Dhanmondi, Dhaka",
            "email": "not-an-email",
        },
    )
    assert response.status_code == 422


async def test_missing_address_is_rejected(client: AsyncClient) -> None:
    created = await _create_customer(client)
    token = await _issue_token(client, created["id"])

    response = await client.patch(
        f"/api/v1/public/customer-profile/{token}",
        json={"date_of_birth": "1995-05-10", "address": "  "},
    )
    assert response.status_code == 422


async def test_future_date_of_birth_is_rejected(client: AsyncClient) -> None:
    created = await _create_customer(client)
    token = await _issue_token(client, created["id"])

    response = await client.patch(
        f"/api/v1/public/customer-profile/{token}",
        json={"date_of_birth": "2999-01-01", "address": "Dhanmondi, Dhaka"},
    )
    assert response.status_code == 422


async def test_public_update_cannot_change_admin_only_fields_or_create_customers(
    client: AsyncClient,
) -> None:
    created = await _create_customer(client, is_vip=False)
    token = await _issue_token(client, created["id"])

    response = await client.patch(
        f"/api/v1/public/customer-profile/{token}",
        json={
            "date_of_birth": "1995-05-10",
            "address": "Dhanmondi, Dhaka",
            "is_vip": True,
            "status": "suspended",
            "name": "Someone Else",
            "phone": "01999999999",
        },
    )
    assert response.status_code == 200

    admin_view = await client.get("/api/v1/customers")
    assert admin_view.json()["meta"]["total"] == 1
    admin_data = admin_view.json()["data"][0]
    assert admin_data["is_vip"] is False
    assert admin_data["status"] == "active"
    assert admin_data["name"] == "Rahim Uddin"
    assert admin_data["phone"] == "01711000101"


async def test_patch_with_invalid_token_does_not_touch_any_customer(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _create_customer(client)

    response = await client.patch(
        "/api/v1/public/customer-profile/not-a-real-token",
        json={"date_of_birth": "1995-05-10", "address": "Dhanmondi, Dhaka"},
    )
    assert response.status_code == 404

    customer = (await db_session.execute(select(Customer))).scalar_one()
    assert customer.date_of_birth is None
    assert customer.address is None
