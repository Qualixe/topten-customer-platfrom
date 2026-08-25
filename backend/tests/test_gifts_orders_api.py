from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import merge_credential_data
from app.common.sms_gateway_client import SendSmsResult
from app.models.customer import Customer
from app.models.gift_catalog_item import GiftCatalogItem
from app.models.gift_order import GiftOrder
from app.services.sms_campaigns import SMS_GATEWAY_PROVIDER


async def _add_customer(
    db_session: AsyncSession, *, name: str = "Rahim Uddin", phone: str = "+8801711000101"
) -> Customer:
    customer = Customer(name=name, phone=phone, normalized_phone=phone, customer_type="GENERAL")
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def _add_catalog_item(
    db_session: AsyncSession, *, name: str = "Test Gift", stock_quantity: int = 10
) -> GiftCatalogItem:
    item = GiftCatalogItem(
        name=name,
        category="FOOD_AND_BEVERAGE",
        description="A test gift",
        points_cost=100,
        retail_value="500.00",
        stock_quantity=stock_quantity,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


async def test_create_gift_order(client: AsyncClient, db_session: AsyncSession) -> None:
    customer = await _add_customer(db_session)
    item = await _add_catalog_item(db_session)

    response = await client.post(
        "/api/v1/gifts/orders",
        json={
            "customer_id": str(customer.public_id),
            "catalog_item_id": str(item.public_id),
            "occasion": "BIRTHDAY",
        },
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["status"] == "PENDING"
    assert data["gift_name"] == item.name
    assert data["customer"]["name"] == customer.name


async def test_create_gift_order_rejects_out_of_stock(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session)
    item = await _add_catalog_item(db_session, stock_quantity=0)

    response = await client.post(
        "/api/v1/gifts/orders",
        json={
            "customer_id": str(customer.public_id),
            "catalog_item_id": str(item.public_id),
            "occasion": "BIRTHDAY",
        },
    )
    assert response.status_code == 422


async def test_schedule_gift_order(client: AsyncClient, db_session: AsyncSession) -> None:
    customer = await _add_customer(db_session)
    item = await _add_catalog_item(db_session)
    order = GiftOrder(
        customer_id=customer.id, catalog_item_id=item.id,
        gift_name=item.name, points_cost=item.points_cost, occasion="BIRTHDAY",
    )
    db_session.add(order)
    await db_session.commit()
    await db_session.refresh(order)

    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    response = await client.patch(
        f"/api/v1/gifts/orders/{order.public_id}",
        json={"status": "SCHEDULED", "scheduled_for": tomorrow},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "SCHEDULED"
    assert data["scheduled_for"] == tomorrow


async def test_schedule_gift_order_rejects_past_date(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session)
    item = await _add_catalog_item(db_session)
    order = GiftOrder(
        customer_id=customer.id, catalog_item_id=item.id,
        gift_name=item.name, points_cost=item.points_cost, occasion="BIRTHDAY",
    )
    db_session.add(order)
    await db_session.commit()
    await db_session.refresh(order)

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    response = await client.patch(
        f"/api/v1/gifts/orders/{order.public_id}",
        json={"status": "SCHEDULED", "scheduled_for": yesterday},
    )
    assert response.status_code == 422


async def test_send_gift_order_decrements_stock_and_increments_redeemed(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await merge_credential_data(
        db_session,
        SMS_GATEWAY_PROVIDER,
        {"api_url": "https://example.com/api/smsapi", "api_key": "key", "sender_id": "TOPTEN"},
    )
    customer = await _add_customer(db_session)
    item = await _add_catalog_item(db_session, stock_quantity=5)
    order = GiftOrder(
        customer_id=customer.id, catalog_item_id=item.id,
        gift_name=item.name, points_cost=item.points_cost, occasion="BIRTHDAY",
    )
    db_session.add(order)
    await db_session.commit()
    await db_session.refresh(order)

    mock_result = SendSmsResult(success=True, http_status=200, message="OK")
    with patch(
        "app.services.gifts.gateway_send_sms", new=AsyncMock(return_value=mock_result)
    ) as mock_send:
        response = await client.patch(
            f"/api/v1/gifts/orders/{order.public_id}", json={"status": "SENT"}
        )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "SENT"
    assert data["notification_error"] is None

    _, kwargs = mock_send.call_args
    assert kwargs["number"] == customer.phone
    assert customer.name in kwargs["message"]
    assert item.name in kwargs["message"]

    await db_session.refresh(item)
    assert item.stock_quantity == 4
    assert item.times_redeemed == 1


async def test_send_gift_order_sms_failure_still_marks_sent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """A failed notification must not block the gift itself being recorded
    as sent — only `notification_error` reflects the SMS failure."""
    await merge_credential_data(
        db_session,
        SMS_GATEWAY_PROVIDER,
        {"api_url": "https://example.com/api/smsapi", "api_key": "key", "sender_id": "TOPTEN"},
    )
    customer = await _add_customer(db_session)
    item = await _add_catalog_item(db_session, stock_quantity=5)
    order = GiftOrder(
        customer_id=customer.id, catalog_item_id=item.id,
        gift_name=item.name, points_cost=item.points_cost, occasion="BIRTHDAY",
    )
    db_session.add(order)
    await db_session.commit()
    await db_session.refresh(order)

    mock_result = SendSmsResult(success=False, http_status=500, message="Provider error")
    with patch("app.services.gifts.gateway_send_sms", new=AsyncMock(return_value=mock_result)):
        response = await client.patch(
            f"/api/v1/gifts/orders/{order.public_id}", json={"status": "SENT"}
        )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "SENT"
    assert data["notification_error"] is not None

    await db_session.refresh(item)
    assert item.stock_quantity == 4
    assert item.times_redeemed == 1


async def test_send_gift_order_without_gateway_config_still_marks_sent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session)
    item = await _add_catalog_item(db_session)
    order = GiftOrder(
        customer_id=customer.id, catalog_item_id=item.id,
        gift_name=item.name, points_cost=item.points_cost, occasion="BIRTHDAY",
    )
    db_session.add(order)
    await db_session.commit()
    await db_session.refresh(order)

    response = await client.patch(
        f"/api/v1/gifts/orders/{order.public_id}", json={"status": "SENT"}
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "SENT"
    assert data["notification_error"] is not None


async def test_cannot_send_an_already_sent_order(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session)
    item = await _add_catalog_item(db_session)
    order = GiftOrder(
        customer_id=customer.id, catalog_item_id=item.id,
        gift_name=item.name, points_cost=item.points_cost, occasion="BIRTHDAY", status="SENT",
    )
    db_session.add(order)
    await db_session.commit()
    await db_session.refresh(order)

    response = await client.patch(
        f"/api/v1/gifts/orders/{order.public_id}", json={"status": "SENT"}
    )
    assert response.status_code == 422


async def test_cancel_gift_order(client: AsyncClient, db_session: AsyncSession) -> None:
    customer = await _add_customer(db_session)
    item = await _add_catalog_item(db_session)
    order = GiftOrder(
        customer_id=customer.id, catalog_item_id=item.id,
        gift_name=item.name, points_cost=item.points_cost, occasion="BIRTHDAY",
    )
    db_session.add(order)
    await db_session.commit()
    await db_session.refresh(order)

    response = await client.patch(
        f"/api/v1/gifts/orders/{order.public_id}", json={"status": "CANCELLED"}
    )
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "CANCELLED"


async def test_list_orders_filters_by_status(client: AsyncClient, db_session: AsyncSession) -> None:
    customer = await _add_customer(db_session)
    item = await _add_catalog_item(db_session)
    pending = GiftOrder(
        customer_id=customer.id, catalog_item_id=item.id,
        gift_name=item.name, points_cost=item.points_cost, occasion="BIRTHDAY", status="PENDING",
    )
    sent = GiftOrder(
        customer_id=customer.id, catalog_item_id=item.id,
        gift_name=item.name, points_cost=item.points_cost, occasion="BIRTHDAY", status="SENT",
    )
    db_session.add_all([pending, sent])
    await db_session.commit()

    response = await client.get("/api/v1/gifts/orders", params={"status": "PENDING"})
    statuses = {row["status"] for row in response.json()["data"]}
    assert statuses == {"PENDING"}
