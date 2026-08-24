"""POST /api/v1/customers — manually adding a single customer."""

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models.customer import Customer


async def test_create_customer_persists_and_returns_it(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    response = await client.post(
        "/api/v1/customers",
        json={"name": "Rahim Uddin", "phone": "01711000101", "email": "rahim@example.com"},
    )
    assert response.status_code == 201

    body = response.json()
    assert body["success"] is True
    assert body["data"]["name"] == "Rahim Uddin"
    assert body["data"]["phone"] == "01711000101"
    assert body["data"]["email"] == "rahim@example.com"
    assert body["data"]["is_vip"] is False
    assert body["data"]["total_spent"] == "0.00"

    stored = (
        await db_session.execute(select(Customer).where(Customer.name == "Rahim Uddin"))
    ).scalar_one()
    assert stored.normalized_phone == "+8801711000101"


async def test_create_customer_rejects_invalid_phone(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/customers", json={"name": "Bad Phone", "phone": "123"}
    )
    assert response.status_code == 422


async def test_create_customer_rejects_blank_name(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/customers", json={"name": "   ", "phone": "01711000101"}
    )
    assert response.status_code == 422


async def test_create_customer_rejects_duplicate_phone(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    first = await client.post(
        "/api/v1/customers", json={"name": "First", "phone": "01711000102"}
    )
    assert first.status_code == 201

    second = await client.post(
        "/api/v1/customers", json={"name": "Second", "phone": "01711000102"}
    )
    assert second.status_code == 422
    assert "already exists" in second.json()["detail"]


async def test_create_customer_allows_marking_vip(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/customers",
        json={"name": "VIP Customer", "phone": "01711000103", "is_vip": True},
    )
    assert response.status_code == 201
    assert response.json()["data"]["is_vip"] is True
