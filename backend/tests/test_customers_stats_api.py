"""GET /api/v1/customers/stats and /api/v1/customers/upcoming-birthdays."""

from datetime import date, timedelta
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models.customer import Customer


async def _add_customer(
    db_session: AsyncSession,
    *,
    name: str,
    phone: str,
    is_vip: bool = False,
    total_spent: str = "0",
    date_of_birth: date | None = None,
) -> Customer:
    customer = Customer(
        name=name,
        phone=phone,
        normalized_phone=phone,
        is_vip=is_vip,
        total_spent=Decimal(total_spent),
        date_of_birth=date_of_birth,
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def test_stats_are_zero_for_an_empty_database(client: AsyncClient) -> None:
    response = await client.get("/api/v1/customers/stats")
    assert response.status_code == 200
    assert response.json()["data"] == {
        "total_customers": 0,
        "vip_customers": 0,
        "birthdays_this_month": 0,
        "total_revenue": "0",
    }


async def test_stats_reflect_real_customer_rows(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _add_customer(
        db_session, name="VIP One", phone="+8801711000101", is_vip=True, total_spent="1000.00"
    )
    await _add_customer(
        db_session, name="Regular One", phone="+8801711000102", is_vip=False, total_spent="500.00"
    )

    response = await client.get("/api/v1/customers/stats")
    data = response.json()["data"]

    assert data["total_customers"] == 2
    assert data["vip_customers"] == 1
    assert Decimal(data["total_revenue"]) == Decimal("1500.00")


async def test_upcoming_birthdays_excludes_customers_without_a_dob(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _add_customer(db_session, name="No DOB", phone="+8801711000101")

    response = await client.get("/api/v1/customers/upcoming-birthdays")
    assert response.json()["data"] == []


async def test_upcoming_birthdays_returns_customers_within_window_sorted_by_proximity(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    today = date.today()
    soon = today + timedelta(days=5)
    later = today + timedelta(days=20)
    far_away = today + timedelta(days=200)

    await _add_customer(
        db_session, name="Far Away", phone="+8801711000101", date_of_birth=far_away
    )
    await _add_customer(db_session, name="Later", phone="+8801711000102", date_of_birth=later)
    await _add_customer(db_session, name="Soon", phone="+8801711000103", date_of_birth=soon)

    response = await client.get("/api/v1/customers/upcoming-birthdays", params={"within_days": 30})
    names = [row["name"] for row in response.json()["data"]]

    assert names == ["Soon", "Later"]
