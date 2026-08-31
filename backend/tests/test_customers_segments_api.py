"""GET /api/v1/customers/segments — live audience breakdowns by status and VIP tier."""

from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer


async def _add_customer(
    db_session: AsyncSession,
    *,
    name: str,
    phone: str,
    status: str = "active",
    is_vip: bool = False,
) -> Customer:
    customer = Customer(
        name=name,
        phone=phone,
        normalized_phone=phone,
        status=status,
        is_vip=is_vip,
        total_spent=Decimal("0"),
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def test_segments_empty_when_no_customers(client: AsyncClient) -> None:
    response = await client.get("/api/v1/customers/segments")
    assert response.status_code == 200

    body = response.json()
    assert body["data"] == {"by_status": [], "by_tier": []}


async def test_segments_group_by_status_and_tier(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _add_customer(db_session, name="Rahim", phone="+8801711000101", status="active")
    await _add_customer(db_session, name="Karim", phone="+8801711000102", status="active")
    await _add_customer(db_session, name="Suspended", phone="+8801711000103", status="suspended")
    await _add_customer(
        db_session, name="VIP One", phone="+8801711000104", is_vip=True
    )

    response = await client.get("/api/v1/customers/segments")
    body = response.json()["data"]

    by_status = {bucket["value"]: bucket["count"] for bucket in body["by_status"]}
    assert by_status == {"active": 3, "suspended": 1}

    by_tier = {bucket["value"]: bucket["count"] for bucket in body["by_tier"]}
    assert by_tier == {"REGULAR": 3, "VIP": 1}


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
