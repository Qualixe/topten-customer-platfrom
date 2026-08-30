"""Gift catalog CRUD and the gift order lifecycle
(PENDING → SCHEDULED → SENT, or → CANCELLED at any point).

Sending happens synchronously within the request (unlike SMS campaigns,
which go through Celery) — a gift order is always exactly one recipient,
so there's no batch to run in the background."""

from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path
from typing import NamedTuple
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import get_or_create_credential_row
from app.common.exceptions import NotFoundError, ValidationAppError
from app.common.sms_gateway_client import RequestStyle
from app.common.sms_gateway_client import send_sms as gateway_send_sms
from app.models.customer import Customer
from app.models.gift_catalog_item import GiftCatalogItem
from app.models.gift_category import GiftCategory
from app.models.gift_order import GiftOccasion, GiftOrder, GiftOrderStatus
from app.services.sms_campaigns import SMS_GATEWAY_PROVIDER
from app.services.sms_campaigns_personalization import render_message
from app.views.notifications import (
    DEFAULT_API_KEY_FIELD,
    DEFAULT_MESSAGE_FIELD,
    DEFAULT_NUMBER_FIELD,
    DEFAULT_SENDER_ID_FIELD,
)


def render_gift_sms_message(
    *, customer_name: str, gift_name: str, wish_text: str | None = None
) -> str:
    """The "gift sent" SMS text — shared with app.services.notification_log
    so the notification log's reconstructed message text can never drift
    from what send_gift_order actually sent.

    `wish_text` (typed by the admin at queue time, see GiftOrder.wish_text)
    replaces the default template when set, with `{{customer_name}}`
    substituted the same way campaign messages are — everything else about
    the template stays a fixed fallback for orders that don't set one."""
    if wish_text:
        return render_message(wish_text, customer_name=customer_name)
    return (
        f'Hi {customer_name}, your gift "{gift_name}" is on its way! '
        "Thank you for being a valued TopTen customer."
    )


async def get_category_or_404(db: AsyncSession, category_id: UUID) -> GiftCategory:
    category = (
        await db.execute(select(GiftCategory).where(GiftCategory.public_id == category_id))
    ).scalar_one_or_none()
    if category is None:
        raise NotFoundError("Gift category not found")
    return category


async def list_categories(db: AsyncSession) -> list[GiftCategory]:
    result = await db.execute(select(GiftCategory).order_by(GiftCategory.name))
    return list(result.scalars().all())


async def create_category(db: AsyncSession, *, name: str) -> GiftCategory:
    existing = (
        await db.execute(select(GiftCategory).where(GiftCategory.name == name))
    ).scalar_one_or_none()
    if existing is not None:
        raise ValidationAppError(f'A category named "{name}" already exists')

    category = GiftCategory(name=name)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def update_category(db: AsyncSession, category: GiftCategory, *, name: str) -> GiftCategory:
    conflict = (
        await db.execute(
            select(GiftCategory).where(GiftCategory.name == name, GiftCategory.id != category.id)
        )
    ).scalar_one_or_none()
    if conflict is not None:
        raise ValidationAppError(f'A category named "{name}" already exists')

    category.name = name
    await db.commit()
    await db.refresh(category)
    return category


async def delete_category(db: AsyncSession, category: GiftCategory) -> None:
    in_use = (
        await db.execute(
            select(GiftCatalogItem).where(GiftCatalogItem.category_id == category.id).limit(1)
        )
    ).scalar_one_or_none()
    if in_use is not None:
        raise ValidationAppError(
            f'Cannot delete "{category.name}" — it\'s still used by one or more gifts. '
            "Move those gifts to another category first."
        )

    await db.delete(category)
    await db.commit()


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
    category_id: int,
    description: str,
    retail_value: Decimal,
    stock_quantity: int,
) -> GiftCatalogItem:
    item = GiftCatalogItem(
        name=name,
        category_id=category_id,
        description=description,
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
    category_id: int | None,
    description: str | None,
    retail_value: Decimal | None,
    stock_quantity: int | None,
) -> GiftCatalogItem:
    if name is not None:
        item.name = name
    if category_id is not None:
        item.category_id = category_id
    if description is not None:
        item.description = description
    if retail_value is not None:
        item.retail_value = retail_value
    if stock_quantity is not None:
        item.stock_quantity = stock_quantity

    await db.commit()
    await db.refresh(item)
    return item


async def delete_catalog_item(db: AsyncSession, item: GiftCatalogItem) -> None:
    image_path = Path(item.image_path) if item.image_path else None
    await db.delete(item)
    await db.commit()
    if image_path and image_path.exists():
        image_path.unlink()


async def get_gift_order_or_404(db: AsyncSession, order_id: UUID) -> GiftOrder:
    order = (
        await db.execute(select(GiftOrder).where(GiftOrder.public_id == order_id))
    ).scalar_one_or_none()
    if order is None:
        raise NotFoundError("Gift order not found")
    return order


async def _get_customer_or_404(db: AsyncSession, customer_id: UUID) -> Customer:
    customer = (
        await db.execute(select(Customer).where(Customer.public_id == customer_id))
    ).scalar_one_or_none()
    if customer is None:
        raise NotFoundError("Customer not found")
    return customer


async def create_gift_order(
    db: AsyncSession,
    *,
    customer_id: UUID,
    catalog_item_id: UUID,
    occasion: GiftOccasion,
    delivery_address: str | None = None,
    wish_text: str | None = None,
) -> GiftOrder:
    customer = await _get_customer_or_404(db, customer_id)

    catalog_item = await get_catalog_item_or_404(db, catalog_item_id)
    if catalog_item.stock_quantity <= 0:
        raise ValidationAppError(f'"{catalog_item.name}" is out of stock')

    order = GiftOrder(
        customer_id=customer.id,
        catalog_item_id=catalog_item.id,
        gift_name=catalog_item.name,
        occasion=occasion.value,
        delivery_address=delivery_address,
        wish_text=wish_text,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


class BulkGiftRecipient(NamedTuple):
    customer_id: UUID
    delivery_address: str | None
    wish_text: str | None


async def create_gift_orders_bulk(
    db: AsyncSession,
    *,
    recipients: list[BulkGiftRecipient],
    catalog_item_id: UUID,
    occasion: GiftOccasion,
) -> list[GiftOrder]:
    """Queues the same gift, for the same occasion, to several customers at
    once (e.g. a birthday batch). Every recipient is validated up front —
    and the catalog item must be in stock — before any order is added, so
    an unknown customer_id partway through a batch can't leave some orders
    created and others silently missing. Returns orders in the same order
    as `recipients`, so a caller can zip them back together (e.g. to also
    create a Delivery per recipient that asked for one)."""
    catalog_item = await get_catalog_item_or_404(db, catalog_item_id)
    if catalog_item.stock_quantity <= 0:
        raise ValidationAppError(f'"{catalog_item.name}" is out of stock')

    resolved = [
        (await _get_customer_or_404(db, recipient.customer_id), recipient)
        for recipient in recipients
    ]

    orders = [
        GiftOrder(
            customer_id=customer.id,
            catalog_item_id=catalog_item.id,
            gift_name=catalog_item.name,
            occasion=occasion.value,
            delivery_address=recipient.delivery_address,
            wish_text=recipient.wish_text,
        )
        for customer, recipient in resolved
    ]
    db.add_all(orders)
    await db.commit()
    for order in orders:
        await db.refresh(order)
    return orders


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
        message = render_gift_sms_message(
            customer_name=order.customer.name,
            gift_name=order.gift_name,
            wish_text=order.wish_text,
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
