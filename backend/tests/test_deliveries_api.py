from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.gift_catalog_item import GiftCatalogItem
from app.models.gift_category import GiftCategory
from app.models.gift_order import GiftOrder
from tests.support import get_customer_type_id


async def _add_customer(
    db_session: AsyncSession, *, name: str = "Rahim Uddin", phone: str = "+8801711000101"
) -> Customer:
    customer = Customer(
        name=name,
        phone=phone,
        normalized_phone=phone,
        customer_type_id=await get_customer_type_id(db_session),
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def _get_or_create_category(db_session: AsyncSession, *, name: str = "Test Category") -> GiftCategory:
    existing = (
        await db_session.execute(select(GiftCategory).where(GiftCategory.name == name))
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    category = GiftCategory(name=name)
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)
    return category


async def _add_catalog_item(db_session: AsyncSession, *, name: str = "Test Gift") -> GiftCatalogItem:
    category = await _get_or_create_category(db_session)

    item = GiftCatalogItem(
        name=name,
        category_id=category.id,
        description="A test gift",
        retail_value="500.00",
        stock_quantity=10,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


async def _create_gift_order(client: AsyncClient, db_session: AsyncSession, **customer_kwargs) -> dict:
    customer = await _add_customer(db_session, **customer_kwargs)
    item = await _add_catalog_item(db_session, name=f"Gift for {customer.name}")

    response = await client.post(
        "/api/v1/gifts/orders",
        json={
            "customer_id": str(customer.public_id),
            "catalog_item_id": str(item.public_id),
            "occasion": "BIRTHDAY",
        },
    )
    assert response.status_code == 201
    return response.json()["data"]


def _delivery_payload(gift_order_id: str, **overrides) -> dict:
    payload = {
        "gift_order_id": gift_order_id,
        "courier": "PATHAO",
        "tracking_number": "PTH-2026001",
        "address": "House 12, Gulshan Avenue",
        "city": "Dhaka",
    }
    payload.update(overrides)
    return payload


async def test_create_delivery(client: AsyncClient, db_session: AsyncSession) -> None:
    order = await _create_gift_order(client, db_session)

    response = await client.post(
        "/api/v1/couriers/deliveries", json=_delivery_payload(order["id"])
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["courier"] == "PATHAO"
    assert data["tracking_number"] == "PTH-2026001"
    assert data["status"] == "PENDING_PICKUP"
    assert data["gift_order"]["id"] == order["id"]
    assert data["gift_order"]["customer"]["name"] == "Rahim Uddin"


async def test_create_delivery_rejects_unknown_gift_order(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/couriers/deliveries",
        json=_delivery_payload("00000000-0000-0000-0000-000000000000"),
    )
    assert response.status_code == 404


async def test_create_delivery_rejects_duplicate(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    order = await _create_gift_order(client, db_session)
    await client.post("/api/v1/couriers/deliveries", json=_delivery_payload(order["id"]))

    response = await client.post(
        "/api/v1/couriers/deliveries", json=_delivery_payload(order["id"])
    )
    assert response.status_code == 422


async def test_list_deliveries_filters_by_courier_and_search(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    order_a = await _create_gift_order(client, db_session, name="Farhana Akter", phone="+8801711000102")
    order_b = await _create_gift_order(client, db_session, name="Rakib Hossain", phone="+8801711000103")

    await client.post(
        "/api/v1/couriers/deliveries",
        json=_delivery_payload(order_a["id"], courier="PATHAO", tracking_number="PTH-1"),
    )
    await client.post(
        "/api/v1/couriers/deliveries",
        json=_delivery_payload(order_b["id"], courier="REDX", tracking_number="RDX-1"),
    )

    response = await client.get("/api/v1/couriers/deliveries", params={"courier": "REDX"})
    body = response.json()
    assert body["meta"]["total"] == 1
    assert body["data"][0]["gift_order"]["customer"]["name"] == "Rakib Hossain"

    response = await client.get("/api/v1/couriers/deliveries", params={"search": "farhana"})
    body = response.json()
    assert body["meta"]["total"] == 1
    assert body["data"][0]["tracking_number"] == "PTH-1"


async def test_delivery_stats_breakdown(client: AsyncClient, db_session: AsyncSession) -> None:
    order_a = await _create_gift_order(client, db_session, name="A", phone="+8801711000104")
    order_b = await _create_gift_order(client, db_session, name="B", phone="+8801711000105")

    created_a = (
        await client.post("/api/v1/couriers/deliveries", json=_delivery_payload(order_a["id"]))
    ).json()["data"]
    await client.post(
        "/api/v1/couriers/deliveries",
        json=_delivery_payload(order_b["id"], tracking_number="PTH-2"),
    )

    await client.patch(
        f"/api/v1/couriers/deliveries/{created_a['id']}", json={"status": "DELIVERED"}
    )

    response = await client.get("/api/v1/couriers/deliveries/stats")
    data = response.json()["data"]
    assert data["total"] == 2
    assert data["delivered"] == 1
    assert data["in_transit"] == 0
    assert data["issues"] == 0


async def test_update_delivery_status_sets_delivered_at(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    order = await _create_gift_order(client, db_session)
    created = (
        await client.post("/api/v1/couriers/deliveries", json=_delivery_payload(order["id"]))
    ).json()["data"]
    assert created["delivered_at"] is None

    response = await client.patch(
        f"/api/v1/couriers/deliveries/{created['id']}", json={"status": "DELIVERED"}
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "DELIVERED"
    assert data["delivered_at"] is not None


async def test_update_delivery_status_stores_notes_on_failure(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    order = await _create_gift_order(client, db_session)
    created = (
        await client.post("/api/v1/couriers/deliveries", json=_delivery_payload(order["id"]))
    ).json()["data"]

    response = await client.patch(
        f"/api/v1/couriers/deliveries/{created['id']}",
        json={"status": "FAILED", "notes": "Recipient unreachable"},
    )
    data = response.json()["data"]
    assert data["status"] == "FAILED"
    assert data["notes"] == "Recipient unreachable"


async def test_update_unknown_delivery_404(client: AsyncClient) -> None:
    response = await client.patch(
        "/api/v1/couriers/deliveries/00000000-0000-0000-0000-000000000000",
        json={"status": "DELIVERED"},
    )
    assert response.status_code == 404


async def test_eligible_gift_orders_excludes_orders_with_a_delivery(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    order_with_delivery = await _create_gift_order(
        client, db_session, name="Has Delivery", phone="+8801711000106"
    )
    order_without_delivery = await _create_gift_order(
        client, db_session, name="No Delivery", phone="+8801711000107"
    )
    await client.post(
        "/api/v1/couriers/deliveries", json=_delivery_payload(order_with_delivery["id"])
    )

    response = await client.get("/api/v1/couriers/deliveries/eligible-gift-orders")
    ids = {order["id"] for order in response.json()["data"]}
    assert order_without_delivery["id"] in ids
    assert order_with_delivery["id"] not in ids


async def test_eligible_gift_orders_excludes_cancelled(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    order = await _create_gift_order(client, db_session)
    gift_order_row = (
        await db_session.execute(select(GiftOrder).where(GiftOrder.public_id == order["id"]))
    ).scalar_one()
    gift_order_row.status = "CANCELLED"
    await db_session.commit()

    response = await client.get("/api/v1/couriers/deliveries/eligible-gift-orders")
    ids = {row["id"] for row in response.json()["data"]}
    assert order["id"] not in ids
