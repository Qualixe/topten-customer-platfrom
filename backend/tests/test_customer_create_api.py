"""POST /api/v1/customers — manually adding a single customer."""

from httpx import AsyncClient
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.customer_type import CustomerType


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


async def test_create_customer_with_internal_notes(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/customers",
        json={
            "name": "Karim Hossain",
            "phone": "01711000102",
            "internal_notes": "Prefers home delivery",
        },
    )
    assert response.status_code == 201
    assert response.json()["data"]["internal_notes"] == "Prefers home delivery"


async def test_create_customer_internal_notes_defaults_to_none(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/customers", json={"name": "No Notes", "phone": "01711000103"}
    )
    assert response.status_code == 201
    assert response.json()["data"]["internal_notes"] is None


async def test_create_customer_customer_note_defaults_to_none(client: AsyncClient) -> None:
    """customer_note is read-only from this endpoint — only
    submit_generic_form (a public, tokenless form submission) ever sets
    it, never the admin-facing create/update API."""
    response = await client.post(
        "/api/v1/customers",
        json={"name": "No Customer Note", "phone": "01711000104", "customer_note": "ignored"},
    )
    assert response.status_code == 201
    assert response.json()["data"]["customer_note"] is None


async def test_create_customer_without_a_type_falls_back_when_general_is_missing(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """An account that has replaced General/VIP/VVIP with its own taxonomy
    (e.g. via Database Reset predating the fix that re-seeds them) must
    still be able to add a customer without picking a type explicitly —
    falling back to whichever type exists, rather than a hard 500."""
    custom_type = CustomerType(name="Wholesale")
    db_session.add(custom_type)
    await db_session.execute(
        delete(CustomerType).where(CustomerType.name.in_(["General", "VIP", "VVIP"]))
    )
    await db_session.commit()

    response = await client.post(
        "/api/v1/customers", json={"name": "No Type Picked", "phone": "01711000199"}
    )
    assert response.status_code == 201
    assert response.json()["data"]["customer_type"]["name"] == "Wholesale"


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


async def test_create_customer_persists_city(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/customers",
        json={"name": "City Customer", "phone": "01711000104", "city": "Dhaka"},
    )
    assert response.status_code == 201
    assert response.json()["data"]["city"] == "Dhaka"


async def test_create_customer_blank_city_becomes_none(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/customers",
        json={"name": "No City", "phone": "01711000105", "city": "   "},
    )
    assert response.status_code == 201
    assert response.json()["data"]["city"] is None


async def test_update_customer_can_set_and_clear_city(client: AsyncClient) -> None:
    created = await client.post(
        "/api/v1/customers", json={"name": "Updatable", "phone": "01711000106"}
    )
    customer_id = created.json()["data"]["id"]

    set_response = await client.patch(
        f"/api/v1/customers/{customer_id}", json={"city": "Chattogram"}
    )
    assert set_response.status_code == 200
    assert set_response.json()["data"]["city"] == "Chattogram"

    clear_response = await client.patch(
        f"/api/v1/customers/{customer_id}", json={"city": None}
    )
    assert clear_response.status_code == 200
    assert clear_response.json()["data"]["city"] is None
