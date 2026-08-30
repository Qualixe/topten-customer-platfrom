from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import merge_credential_data
from app.common.sms_gateway_client import SendSmsResult
from app.models.customer import Customer
from app.models.gift_catalog_item import GiftCatalogItem
from app.models.gift_category import GiftCategory
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


async def _get_or_create_category(
    db_session: AsyncSession, *, name: str = "Test Category"
) -> GiftCategory:
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


async def _add_catalog_item(
    db_session: AsyncSession, *, name: str = "Test Gift", stock_quantity: int = 10
) -> GiftCatalogItem:
    category = await _get_or_create_category(db_session)
    item = GiftCatalogItem(
        name=name,
        category_id=category.id,
        description="A test gift",
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


async def test_create_gift_order_with_delivery_address(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session)
    item = await _add_catalog_item(db_session)

    response = await client.post(
        "/api/v1/gifts/orders",
        json={
            "customer_id": str(customer.public_id),
            "catalog_item_id": str(item.public_id),
            "occasion": "BIRTHDAY",
            "delivery_address": "House 12, Gulshan Avenue",
        },
    )
    assert response.status_code == 201
    assert response.json()["data"]["delivery_address"] == "House 12, Gulshan Avenue"


async def test_create_gift_order_without_delivery_address_is_null(
    client: AsyncClient, db_session: AsyncSession
) -> None:
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
    assert response.json()["data"]["delivery_address"] is None


async def test_create_gift_order_with_wish_text(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session)
    item = await _add_catalog_item(db_session)

    response = await client.post(
        "/api/v1/gifts/orders",
        json={
            "customer_id": str(customer.public_id),
            "catalog_item_id": str(item.public_id),
            "occasion": "BIRTHDAY",
            "wish_text": "Happy Birthday {{customer_name}}! 🎂",
        },
    )
    assert response.status_code == 201
    assert response.json()["data"]["wish_text"] == "Happy Birthday {{customer_name}}! 🎂"


async def test_create_gift_orders_bulk(client: AsyncClient, db_session: AsyncSession) -> None:
    customer_a = await _add_customer(db_session, name="Farhana Akter", phone="+8801711000201")
    customer_b = await _add_customer(db_session, name="Rakib Hossain", phone="+8801711000202")
    item = await _add_catalog_item(db_session, stock_quantity=10)

    response = await client.post(
        "/api/v1/gifts/orders/bulk",
        json={
            "recipients": [
                {"customer_id": str(customer_a.public_id), "delivery_address": "House 1, Road 2"},
                {"customer_id": str(customer_b.public_id)},
            ],
            "catalog_item_id": str(item.public_id),
            "occasion": "VIP_REWARD",
        },
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert len(data) == 2
    by_name = {order["customer"]["name"]: order for order in data}
    assert by_name["Farhana Akter"]["delivery_address"] == "House 1, Road 2"
    assert by_name["Rakib Hossain"]["delivery_address"] is None
    assert all(order["occasion"] == "VIP_REWARD" for order in data)
    assert all(order["gift_name"] == item.name for order in data)


async def test_create_gift_orders_bulk_with_courier_creates_delivery(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session, name="Nadia Islam", phone="+8801711000205")
    item = await _add_catalog_item(db_session, stock_quantity=10)

    response = await client.post(
        "/api/v1/gifts/orders/bulk",
        json={
            "recipients": [
                {
                    "customer_id": str(customer.public_id),
                    "delivery_address": "House 5, Road 10",
                    "courier": "PATHAO",
                    "tracking_number": "PTH-9001",
                    "city": "Dhaka",
                }
            ],
            "catalog_item_id": str(item.public_id),
            "occasion": "BIRTHDAY",
        },
    )
    assert response.status_code == 201
    order_id = response.json()["data"][0]["id"]

    deliveries_response = await client.get(
        "/api/v1/couriers/deliveries", params={"search": "Nadia Islam"}
    )
    deliveries = deliveries_response.json()["data"]
    assert len(deliveries) == 1
    assert deliveries[0]["gift_order"]["id"] == order_id
    assert deliveries[0]["courier"] == "PATHAO"
    assert deliveries[0]["tracking_number"] == "PTH-9001"
    assert deliveries[0]["city"] == "Dhaka"
    assert deliveries[0]["status"] == "PENDING_PICKUP"


async def test_create_gift_orders_bulk_courier_requires_shipping_details(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session)
    item = await _add_catalog_item(db_session, stock_quantity=10)

    response = await client.post(
        "/api/v1/gifts/orders/bulk",
        json={
            "recipients": [{"customer_id": str(customer.public_id), "courier": "PATHAO"}],
            "catalog_item_id": str(item.public_id),
            "occasion": "BIRTHDAY",
        },
    )
    assert response.status_code == 422


async def test_create_gift_orders_bulk_rejects_unknown_customer(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session)
    item = await _add_catalog_item(db_session, stock_quantity=10)

    response = await client.post(
        "/api/v1/gifts/orders/bulk",
        json={
            "recipients": [
                {"customer_id": str(customer.public_id)},
                {"customer_id": "00000000-0000-0000-0000-000000000000"},
            ],
            "catalog_item_id": str(item.public_id),
            "occasion": "BIRTHDAY",
        },
    )
    assert response.status_code == 404

    # Nothing from the batch was created — the whole request rolled back.
    list_response = await client.get(
        "/api/v1/gifts/orders", params={"catalog_item_id": str(item.public_id)}
    )
    assert list_response.json()["meta"]["total"] == 0


async def test_create_gift_orders_bulk_rejects_out_of_stock(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer_a = await _add_customer(db_session, name="Nadia Islam", phone="+8801711000203")
    customer_b = await _add_customer(db_session, name="Kamrul Haque", phone="+8801711000204")
    item = await _add_catalog_item(db_session, stock_quantity=0)

    response = await client.post(
        "/api/v1/gifts/orders/bulk",
        json={
            "recipients": [
                {"customer_id": str(customer_a.public_id)},
                {"customer_id": str(customer_b.public_id)},
            ],
            "catalog_item_id": str(item.public_id),
            "occasion": "BIRTHDAY",
        },
    )
    assert response.status_code == 422


async def test_create_gift_orders_bulk_requires_at_least_one_recipient(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    item = await _add_catalog_item(db_session)

    response = await client.post(
        "/api/v1/gifts/orders/bulk",
        json={"recipients": [], "catalog_item_id": str(item.public_id), "occasion": "BIRTHDAY"},
    )
    assert response.status_code == 422


async def test_schedule_gift_order(client: AsyncClient, db_session: AsyncSession) -> None:
    customer = await _add_customer(db_session)
    item = await _add_catalog_item(db_session)
    order = GiftOrder(
        customer_id=customer.id, catalog_item_id=item.id,
        gift_name=item.name, occasion="BIRTHDAY",
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
        gift_name=item.name, occasion="BIRTHDAY",
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
        gift_name=item.name, occasion="BIRTHDAY",
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


async def test_send_gift_order_uses_wish_text_over_default_template(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await merge_credential_data(
        db_session,
        SMS_GATEWAY_PROVIDER,
        {"api_url": "https://example.com/api/smsapi", "api_key": "key", "sender_id": "TOPTEN"},
    )
    customer = await _add_customer(db_session, name="Ayesha Sultana")
    item = await _add_catalog_item(db_session, stock_quantity=5)
    order = GiftOrder(
        customer_id=customer.id,
        catalog_item_id=item.id,
        gift_name=item.name,
        occasion="BIRTHDAY",
        wish_text="Happiest of birthdays, {{customer_name}}! Enjoy your gift.",
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
    _, kwargs = mock_send.call_args
    assert kwargs["message"] == "Happiest of birthdays, Ayesha Sultana! Enjoy your gift."


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
        gift_name=item.name, occasion="BIRTHDAY",
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
        gift_name=item.name, occasion="BIRTHDAY",
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
        gift_name=item.name, occasion="BIRTHDAY", status="SENT",
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
        gift_name=item.name, occasion="BIRTHDAY",
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
        gift_name=item.name, occasion="BIRTHDAY", status="PENDING",
    )
    sent = GiftOrder(
        customer_id=customer.id, catalog_item_id=item.id,
        gift_name=item.name, occasion="BIRTHDAY", status="SENT",
    )
    db_session.add_all([pending, sent])
    await db_session.commit()

    response = await client.get("/api/v1/gifts/orders", params={"status": "PENDING"})
    statuses = {row["status"] for row in response.json()["data"]}
    assert statuses == {"PENDING"}


async def test_list_orders_filters_by_catalog_item(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session)
    matching_item = await _add_catalog_item(db_session, name="Matching Gift")
    other_item = await _add_catalog_item(db_session, name="Other Gift")
    matching_order = GiftOrder(
        customer_id=customer.id, catalog_item_id=matching_item.id,
        gift_name=matching_item.name, occasion="BIRTHDAY",
    )
    other_order = GiftOrder(
        customer_id=customer.id, catalog_item_id=other_item.id,
        gift_name=other_item.name, occasion="BIRTHDAY",
    )
    db_session.add_all([matching_order, other_order])
    await db_session.commit()

    response = await client.get(
        "/api/v1/gifts/orders", params={"catalog_item_id": str(matching_item.public_id)}
    )
    names = {row["gift_name"] for row in response.json()["data"]}
    assert names == {"Matching Gift"}
