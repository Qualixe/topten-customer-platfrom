"""Gift catalog CRUD and the gift order lifecycle
(PENDING → SCHEDULED → SENT, or → CANCELLED at any point).

Sending happens synchronously within the request (unlike SMS campaigns,
which go through Celery) — a gift order is always exactly one recipient,
so there's no batch to run in the background."""

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import get_or_create_credential_row
from app.common.exceptions import NotFoundError, ValidationAppError
from app.common.sms_gateway_client import RequestStyle
from app.common.sms_gateway_client import send_sms as gateway_send_sms
from app.models.customer import Customer
from app.models.gift_catalog_item import GiftCatalogItem, GiftCategory
from app.models.gift_order import GiftOccasion, GiftOrder, GiftOrderStatus
from app.services.sms_campaigns import SMS_GATEWAY_PROVIDER
from app.views.notifications import (
    DEFAULT_API_KEY_FIELD,
    DEFAULT_MESSAGE_FIELD,
    DEFAULT_NUMBER_FIELD,
    DEFAULT_SENDER_ID_FIELD,
)


async def get_catalog_item_or_404(db: AsyncSession, item_id: UUID) -> GiftCatalogItem:
    item = (
        await db.execute(select(GiftCatalogItem).where(GiftCatalogItem.public_id == item_id))
    ).scalar_one_or_none()
    if item is None:
        raise NotFoundError("Gift not found")
    return item


async def create_catalog_item(
    db: AsyncSession,
    *,
    name: str,
    category: GiftCategory,
    description: str,
    points_cost: int,
    retail_value: Decimal,
    stock_quantity: int,
) -> GiftCatalogItem:
    item = GiftCatalogItem(
        name=name,
        category=category.value,
        description=description,
        points_cost=points_cost,
        retail_value=retail_value,
        stock_quantity=stock_quantity,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def update_catalog_item(
    db: AsyncSession,
    item: GiftCatalogItem,
    *,
    name: str | None,
    category: GiftCategory | None,
    description: str | None,
    points_cost: int | None,
    retail_value: Decimal | None,
    stock_quantity: int | None,
) -> GiftCatalogItem:
    if name is not None:
        item.name = name
    if category is not None:
        item.category = category.value
    if description is not None:
        item.description = description
    if points_cost is not None:
        item.points_cost = points_cost
    if retail_value is not None:
        item.retail_value = retail_value
    if stock_quantity is not None:
        item.stock_quantity = stock_quantity

    await db.commit()
    await db.refresh(item)
    return item


async def delete_catalog_item(db: AsyncSession, item: GiftCatalogItem) -> None:
    await db.delete(item)
    await db.commit()


async def get_gift_order_or_404(db: AsyncSession, order_id: UUID) -> GiftOrder:
    order = (
        await db.execute(select(GiftOrder).where(GiftOrder.public_id == order_id))
    ).scalar_one_or_none()
    if order is None:
        raise NotFoundError("Gift order not found")
    return order


async def create_gift_order(
    db: AsyncSession, *, customer_id: UUID, catalog_item_id: UUID, occasion: GiftOccasion
) -> GiftOrder:
    customer = (
        await db.execute(select(Customer).where(Customer.public_id == customer_id))
    ).scalar_one_or_none()
    if customer is None:
        raise NotFoundError("Customer not found")

    catalog_item = await get_catalog_item_or_404(db, catalog_item_id)
    if catalog_item.stock_quantity <= 0:
        raise ValidationAppError(f'"{catalog_item.name}" is out of stock')

    order = GiftOrder(
        customer_id=customer.id,
        catalog_item_id=catalog_item.id,
        gift_name=catalog_item.name,
        points_cost=catalog_item.points_cost,
        occasion=occasion.value,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


async def schedule_gift_order(
    db: AsyncSession, order: GiftOrder, *, scheduled_for: date
) -> GiftOrder:
    if order.status not in (GiftOrderStatus.PENDING.value, GiftOrderStatus.SCHEDULED.value):
        raise ValidationAppError(f"Cannot schedule a gift order that is already {order.status}")
    if scheduled_for < date.today():
        raise ValidationAppError("Scheduled date cannot be in the past")

    order.status = GiftOrderStatus.SCHEDULED.value
    order.scheduled_for = scheduled_for
    await db.commit()
    await db.refresh(order)
    return order


async def send_gift_order(db: AsyncSession, order: GiftOrder) -> GiftOrder:
    """Marks the order Sent and — best-effort — notifies the customer by
    SMS. A notification failure (bad/missing gateway config, provider
    error) is recorded on `notification_error` but never blocks the
    status transition: the gift itself was handed over regardless of
    whether the courtesy text went through."""
    if order.status not in (GiftOrderStatus.PENDING.value, GiftOrderStatus.SCHEDULED.value):
        raise ValidationAppError(f"Cannot send a gift order that is already {order.status}")

    notification_error: str | None = None
    credential_row = await get_or_create_credential_row(db, SMS_GATEWAY_PROVIDER)
    api_url = credential_row.data.get("api_url")
    api_key = credential_row.data.get("api_key")
    sender_id = credential_row.data.get("sender_id")

    if not api_url or not api_key or not sender_id:
        notification_error = "SMS gateway is not configured (Settings → API Credentials)"
    else:
        message = (
            f'Hi {order.customer.name}, your gift "{order.gift_name}" is on its way! '
            "Thank you for being a valued TopTen customer."
        )
        try:
            result = await gateway_send_sms(
                api_url=api_url,
                api_key=api_key,
                sender_id=sender_id,
                number=order.customer.phone,
                message=message,
                request_style=RequestStyle(
                    credential_row.data.get("request_style") or RequestStyle.GET_QUERY.value
                ),
                api_key_field=credential_row.data.get("api_key_field") or DEFAULT_API_KEY_FIELD,
                sender_id_field=(
                    credential_row.data.get("sender_id_field") or DEFAULT_SENDER_ID_FIELD
                ),
                number_field=credential_row.data.get("number_field") or DEFAULT_NUMBER_FIELD,
                message_field=credential_row.data.get("message_field") or DEFAULT_MESSAGE_FIELD,
                request_id_field=credential_row.data.get("request_id_field"),
                success_field=credential_row.data.get("success_field"),
                success_value=credential_row.data.get("success_value"),
            )
        except httpx.HTTPError as exc:
            notification_error = str(exc)[:500]
        else:
            if not result.success:
                notification_error = f"HTTP {result.http_status}: {result.message}"[:500]

    order.status = GiftOrderStatus.SENT.value
    order.sent_at = datetime.now(UTC)
    order.notification_error = notification_error

    if order.catalog_item_id is not None:
        catalog_item = await db.get(GiftCatalogItem, order.catalog_item_id)
        if catalog_item is not None:
            catalog_item.stock_quantity = max(0, catalog_item.stock_quantity - 1)
            catalog_item.times_redeemed += 1

    await db.commit()
    await db.refresh(order)
    return order


async def cancel_gift_order(db: AsyncSession, order: GiftOrder) -> GiftOrder:
    if order.status in (GiftOrderStatus.SENT.value, GiftOrderStatus.CANCELLED.value):
        raise ValidationAppError(f"Cannot cancel a gift order that is already {order.status}")

    order.status = GiftOrderStatus.CANCELLED.value
    await db.commit()
    await db.refresh(order)
    return order
