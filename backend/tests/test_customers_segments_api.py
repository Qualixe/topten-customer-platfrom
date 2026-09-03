"""GET /api/v1/customers/segments — live audience breakdowns by status and customer type."""

from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from tests.support import get_customer_type_id


async def _add_customer(
    db_session: AsyncSession,
    *,
    name: str,
    phone: str,
    status: str = "active",
    customer_type: str = "General",
) -> Customer:
    customer = Customer(
        name=name,
        phone=phone,
        normalized_phone=phone,
        status=status,
        total_spent=Decimal("0"),
        customer_type_id=await get_customer_type_id(db_session, customer_type),
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def test_segments_empty_when_no_customers(client: AsyncClient) -> None:
    response = await client.get("/api/v1/customers/segments")
    assert response.status_code == 200

    body = response.json()
    assert body["data"] == {"by_status": [], "by_customer_type": []}


async def test_segments_group_by_status_and_customer_type(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _add_customer(db_session, name="Rahim", phone="+8801711000101", status="active")
    await _add_customer(db_session, name="Karim", phone="+8801711000102", status="active")
    await _add_customer(db_session, name="Suspended", phone="+8801711000103", status="suspended")
    await _add_customer(
        db_session, name="VIP One", phone="+8801711000104", customer_type="VIP"
    )

    response = await client.get("/api/v1/customers/segments")
    body = response.json()["data"]

    by_status = {bucket["value"]: bucket["count"] for bucket in body["by_status"]}
    assert by_status == {"active": 3, "suspended": 1}

    by_customer_type = {bucket["label"]: bucket["count"] for bucket in body["by_customer_type"]}
    assert by_customer_type == {"General": 3, "VIP": 1}


async def test_segments_omits_zero_count_values(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _add_customer(db_session, name="Rahim", phone="+8801711000101", status="active")

    response = await client.get("/api/v1/customers/segments")
    by_status_values = {bucket["value"] for bucket in response.json()["data"]["by_status"]}

    assert by_status_values == {"active"}
    assert "inactive" not in by_status_values
    assert "suspended" not in by_status_values


async def test_segments_requires_authentication(unauthenticated_client: AsyncClient) -> None:
    response = await unauthenticated_client.get("/api/v1/customers/segments")
    assert response.status_code == 401
