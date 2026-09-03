"""GET /api/v1/customers/export — CSV export, same filters as the list endpoint."""

import csv
import io
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
    is_vip: bool = False,
    total_spent: str = "0",
) -> Customer:
    customer = Customer(
        name=name,
        phone=phone,
        normalized_phone=phone,
        status=status,
        is_vip=is_vip,
        total_spent=Decimal(total_spent),
        customer_type_id=await get_customer_type_id(db_session),
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


def _parse_csv(body: bytes) -> list[list[str]]:
    return list(csv.reader(io.StringIO(body.decode("utf-8"))))


async def test_export_returns_csv_with_header_and_rows(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(
        db_session, name="Rahim Uddin", phone="+8801711000101", is_vip=True, total_spent="150.50"
    )

    response = await client.get("/api/v1/customers/export")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=" in response.headers["content-disposition"]

    rows = _parse_csv(response.content)
    assert rows[0] == [
        "Customer ID",
        "Name",
        "Phone",
        "Email",
        "Address",
        "Date of Birth",
        "Customer Type",
        "VIP",
        "Total Spent",
        "Status",
        "Profile Status",
        "Created At",
    ]
    assert len(rows) == 2
    assert rows[1][0] == str(customer.public_id)
    assert rows[1][1] == "Rahim Uddin"
    assert rows[1][7] == "Yes"
    assert rows[1][8] == "150.50"


async def test_export_has_only_header_when_no_customers(client: AsyncClient) -> None:
    response = await client.get("/api/v1/customers/export")
    rows = _parse_csv(response.content)
    assert len(rows) == 1


async def test_export_respects_search_filter(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _add_customer(db_session, name="Rahim Uddin", phone="+8801711000101")
    await _add_customer(db_session, name="Karim Hossain", phone="+8801711000102")

    response = await client.get("/api/v1/customers/export", params={"search": "rahim"})
    rows = _parse_csv(response.content)

    assert len(rows) == 2
    assert rows[1][1] == "Rahim Uddin"


async def test_export_respects_is_vip_filter(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _add_customer(db_session, name="VIP One", phone="+8801711000101", is_vip=True)
    await _add_customer(db_session, name="Regular One", phone="+8801711000102", is_vip=False)

    response = await client.get("/api/v1/customers/export", params={"is_vip": "true"})
    rows = _parse_csv(response.content)

    assert len(rows) == 2
    assert rows[1][1] == "VIP One"


async def test_export_ignores_pagination_and_returns_every_matching_row(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    for i in range(5):
        await _add_customer(db_session, name=f"Customer {i}", phone=f"+88017110001{i:02d}")

    # page/page_size aren't accepted params here — every match comes back
    # regardless of what a caller still carrying list-page state might pass.
    response = await client.get(
        "/api/v1/customers/export", params={"page": 1, "page_size": 2}
    )
    rows = _parse_csv(response.content)

    assert len(rows) == 6  # header + 5 customers, not capped at page_size


async def test_export_requires_authentication(unauthenticated_client: AsyncClient) -> None:
    response = await unauthenticated_client.get("/api/v1/customers/export")
    assert response.status_code == 401
