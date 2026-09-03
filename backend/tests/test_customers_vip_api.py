"""GET /api/v1/customers/vip and /api/v1/customers/vip/stats.

This page is scoped to the built-in VIP/VVIP customer type, not the
separate `is_vip` flag — see get_vip_tier_type_ids.
"""

from datetime import date
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.customer_monthly_spending import CustomerMonthlySpending
from tests.support import get_customer_type_id


async def _add_customer(
    db_session: AsyncSession,
    *,
    name: str,
    phone: str,
    customer_type: str = "General",
    status: str = "active",
    total_spent: str = "0",
) -> Customer:
    customer = Customer(
        name=name,
        phone=phone,
        normalized_phone=phone,
        status=status,
        total_spent=Decimal(total_spent),
        customer_type_id=await get_customer_type_id(db_session, customer_type),
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def _add_spending(
    db_session: AsyncSession, customer: Customer, *, year: int, month: int, amount: str
) -> None:
    db_session.add(
        CustomerMonthlySpending(
            customer_id=customer.id, year=year, month=month, amount=Decimal(amount)
        )
    )
    await db_session.commit()


async def test_vip_list_only_returns_vip_and_vvip_types(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _add_customer(
        db_session,
        name="VIP One",
        phone="+8801711000101",
        customer_type="VIP",
        total_spent="1000",
    )
    await _add_customer(
        db_session,
        name="VVIP One",
        phone="+8801711000102",
        customer_type="VVIP",
        total_spent="2000",
    )
    await _add_customer(
        db_session,
        name="Regular",
        phone="+8801711000103",
        customer_type="General",
        total_spent="5000",
    )

    response = await client.get("/api/v1/customers/vip")
    data = response.json()["data"]

    names = {row["name"] for row in data}
    assert names == {"VIP One", "VVIP One"}
    vip_row = next(row for row in data if row["name"] == "VIP One")
    assert vip_row["status"] == "ACTIVE"
    assert vip_row["last_purchase_year"] is None
    assert vip_row["last_purchase_month"] is None


async def test_vip_status_is_inactive_when_administratively_not_active(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _add_customer(
        db_session,
        name="Suspended VIP",
        phone="+8801711000101",
        customer_type="VIP",
        status="suspended",
    )

    response = await client.get("/api/v1/customers/vip")
    data = response.json()["data"]

    assert data[0]["status"] == "INACTIVE"


async def test_vip_status_is_at_risk_after_a_stale_last_purchase(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(
        db_session, name="Fading VIP", phone="+8801711000101", customer_type="VIP"
    )
    today = date.today()
    stale_year = today.year if today.month > 3 else today.year - 1
    stale_month = ((today.month - 4) % 12) + 1
    await _add_spending(db_session, customer, year=stale_year, month=stale_month, amount="200")

    response = await client.get("/api/v1/customers/vip")
    data = response.json()["data"]

    assert data[0]["status"] == "AT_RISK"
    assert data[0]["last_purchase_year"] == stale_year
    assert data[0]["last_purchase_month"] == stale_month


async def test_vip_status_stays_active_with_a_recent_purchase(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(
        db_session, name="Fresh VIP", phone="+8801711000101", customer_type="VIP"
    )
    today = date.today()
    await _add_spending(db_session, customer, year=today.year, month=today.month, amount="300")

    response = await client.get("/api/v1/customers/vip")
    data = response.json()["data"]

    assert data[0]["status"] == "ACTIVE"
    assert data[0]["last_purchase_year"] == today.year
    assert data[0]["last_purchase_month"] == today.month


async def test_vip_status_filter(client: AsyncClient, db_session: AsyncSession) -> None:
    await _add_customer(
        db_session,
        name="Suspended VIP",
        phone="+8801711000101",
        customer_type="VIP",
        status="suspended",
    )
    await _add_customer(
        db_session, name="Active VIP", phone="+8801711000102", customer_type="VIP"
    )

    response = await client.get("/api/v1/customers/vip", params={"vip_status": "INACTIVE"})
    names = [row["name"] for row in response.json()["data"]]

    assert names == ["Suspended VIP"]


async def test_vip_stats_reflect_real_rows(client: AsyncClient, db_session: AsyncSession) -> None:
    await _add_customer(
        db_session,
        name="VIP One",
        phone="+8801711000101",
        customer_type="VIP",
        total_spent="1000",
    )
    await _add_customer(
        db_session,
        name="Suspended VIP",
        phone="+8801711000102",
        customer_type="VVIP",
        status="suspended",
        total_spent="500",
    )
    await _add_customer(
        db_session,
        name="Regular",
        phone="+8801711000103",
        customer_type="General",
        total_spent="9999",
    )

    response = await client.get("/api/v1/customers/vip/stats")
    data = response.json()["data"]

    assert data["total_vip_customers"] == 2
    assert Decimal(data["total_vip_revenue"]) == Decimal("1500.00")
    assert Decimal(data["average_spend"]) == Decimal("750.00")
    assert data["at_risk_count"] == 0
