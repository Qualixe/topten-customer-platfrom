"""PATCH and DELETE /api/v1/customers/{id}."""

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.customer_monthly_spending import CustomerMonthlySpending
from app.services import imports as service
from tests.support import create_batch, make_valid_row


async def _create_customer(client: AsyncClient, **overrides) -> dict:
    payload = {"name": "Rahim Uddin", "phone": "01711000101", **overrides}
    response = await client.post("/api/v1/customers", json=payload)
    assert response.status_code == 201
    return response.json()["data"]


async def test_update_changes_only_provided_fields(client: AsyncClient) -> None:
    created = await _create_customer(client, email="rahim@example.com")
    customer_id = created["id"]

    response = await client.patch(f"/api/v1/customers/{customer_id}", json={"is_vip": True})
    assert response.status_code == 200

    data = response.json()["data"]
    assert data["is_vip"] is True
    assert data["name"] == "Rahim Uddin"
    assert data["email"] == "rahim@example.com"


async def test_update_can_clear_an_optional_field(client: AsyncClient) -> None:
    created = await _create_customer(client, email="rahim@example.com")
    customer_id = created["id"]

    response = await client.patch(f"/api/v1/customers/{customer_id}", json={"email": None})
    assert response.status_code == 200
    assert response.json()["data"]["email"] is None


async def test_update_changes_phone_and_reindexes_normalized_phone(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    created = await _create_customer(client)
    customer_id = created["id"]

    response = await client.patch(
        f"/api/v1/customers/{customer_id}", json={"phone": "01899000111"}
    )
    assert response.status_code == 200
    assert response.json()["data"]["phone"] == "01899000111"

    stored = (
        await db_session.execute(select(Customer).where(Customer.public_id == customer_id))
    ).scalar_one()
    assert stored.normalized_phone == "+8801899000111"


async def test_update_rejects_phone_colliding_with_another_customer(
    client: AsyncClient,
) -> None:
    await _create_customer(client, phone="01711000102")
    second = await _create_customer(client, name="Second", phone="01711000103")

    response = await client.patch(
        f"/api/v1/customers/{second['id']}", json={"phone": "01711000102"}
    )
    assert response.status_code == 422


async def test_update_rejects_invalid_status(client: AsyncClient) -> None:
    created = await _create_customer(client)
    response = await client.patch(
        f"/api/v1/customers/{created['id']}", json={"status": "banned"}
    )
    assert response.status_code == 422


async def test_update_missing_customer_returns_404(client: AsyncClient) -> None:
    response = await client.patch(
        "/api/v1/customers/00000000-0000-0000-0000-000000000000", json={"is_vip": True}
    )
    assert response.status_code == 404


async def test_delete_removes_customer(client: AsyncClient, db_session: AsyncSession) -> None:
    created = await _create_customer(client)
    customer_id = created["id"]

    response = await client.delete(f"/api/v1/customers/{customer_id}")
    assert response.status_code == 204

    remaining = (
        await db_session.execute(select(Customer).where(Customer.public_id == customer_id))
    ).scalar_one_or_none()
    assert remaining is None

    list_response = await client.get("/api/v1/customers")
    assert list_response.json()["meta"]["total"] == 0


async def test_delete_also_removes_monthly_spending_rows(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    batch = await create_batch(db_session, year=2026, month=1)
    await service.process_chunk(
        db_session, batch, [make_valid_row("Rahim Uddin", "01711000101", "5000")]
    )
    await db_session.commit()

    customer = (await db_session.execute(select(Customer))).scalar_one()

    response = await client.delete(f"/api/v1/customers/{customer.public_id}")
    assert response.status_code == 204

    remaining_spending = (
        await db_session.execute(
            select(CustomerMonthlySpending).where(
                CustomerMonthlySpending.customer_id == customer.id
            )
        )
    ).scalar_one_or_none()
    assert remaining_spending is None


async def test_delete_missing_customer_returns_404(client: AsyncClient) -> None:
    response = await client.delete("/api/v1/customers/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
