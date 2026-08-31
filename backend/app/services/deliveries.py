"""Courier delivery tracking for gift orders. A `Delivery` is created when
staff hand a gift order to a courier — not every gift order gets one, and
each gift order can have at most one (see `Delivery.gift_order_id`'s unique
constraint).
"""

from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import ValidationAppError
from app.models.customer import Customer
from app.models.delivery import Delivery, DeliveryStatus
from app.models.gift_order import GiftOrder, GiftOrderStatus
from app.services import pathao as pathao_service
from app.views.deliveries import DeliveryStats


def _deliveries_base_query():
    return select(Delivery).join(GiftOrder, Delivery.gift_order_id == GiftOrder.id).join(
        Customer, GiftOrder.customer_id == Customer.id
    )


async def list_deliveries(
    db: AsyncSession,
    page: int,
    page_size: int,
    *,
    courier: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[Delivery], int]:
    filters: list[ColumnElement] = []
    if courier:
        filters.append(Delivery.courier == courier)
    if status:
        filters.append(Delivery.status == status)

    search = (search or "").strip()
    if search:
        filters.append(
            (Delivery.tracking_number.ilike(f"%{search}%"))
            | (Customer.name.ilike(f"%{search}%"))
        )

    base_query = _deliveries_base_query()
    for condition in filters:
        base_query = base_query.where(condition)

    total = (
        await db.execute(
            select(func.count()).select_from(base_query.with_only_columns(Delivery.id).subquery())
        )
    ).scalar_one()

    rows = (
        await db.execute(
            base_query.order_by(Delivery.dispatched_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return list(rows), total


async def get_delivery_stats(db: AsyncSession) -> DeliveryStats:
    rows = (
        await db.execute(select(Delivery.status, func.count()).group_by(Delivery.status))
    ).all()
    counts = {status: count for status, count in rows}

    return DeliveryStats(
        total=sum(counts.values()),
        in_transit=counts.get(DeliveryStatus.IN_TRANSIT.value, 0)
        + counts.get(DeliveryStatus.OUT_FOR_DELIVERY.value, 0),
        delivered=counts.get(DeliveryStatus.DELIVERED.value, 0),
        issues=counts.get(DeliveryStatus.FAILED.value, 0)
        + counts.get(DeliveryStatus.RETURNED.value, 0),
    )


async def get_delivery_by_public_id(db: AsyncSession, public_id: UUID) -> Delivery | None:
    return (
        await db.execute(select(Delivery).where(Delivery.public_id == public_id))
    ).scalar_one_or_none()


async def list_eligible_gift_orders(
    db: AsyncSession, search: str, page: int, page_size: int
) -> tuple[list[GiftOrder], int]:
    """Gift orders with no delivery yet — what a "create delivery" picker
    should offer. Cancelled orders are excluded; nothing else is, since a
    gift can ship via courier regardless of whether its SMS notification
    has gone out yet."""
    already_has_delivery = select(Delivery.gift_order_id)
    condition = GiftOrder.id.notin_(already_has_delivery) & (
        GiftOrder.status != GiftOrderStatus.CANCELLED.value
    )

    base = select(GiftOrder).join(Customer, GiftOrder.customer_id == Customer.id).where(condition)
    count_base = (
        select(func.count())
        .select_from(GiftOrder)
        .join(Customer, GiftOrder.customer_id == Customer.id)
        .where(condition)
    )

    search = search.strip()
    if search:
        name_match = Customer.name.ilike(f"%{search}%")
        base = base.where(name_match)
        count_base = count_base.where(name_match)

    total = (await db.execute(count_base)).scalar_one()
    rows = (
        await db.execute(
            base.order_by(GiftOrder.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return list(rows), total


async def create_delivery(
    db: AsyncSession,
    *,
    gift_order: GiftOrder,
    courier: str,
    address: str,
    city: str,
    estimated_delivery: date | None,
    tracking_number: str | None = None,
    pathao_city_id: int | None = None,
    pathao_zone_id: int | None = None,
    pathao_area_id: int | None = None,
    recipient_name: str | None = None,
    recipient_phone: str | None = None,
) -> Delivery:
    """`tracking_number` is used as-is when given (a shipment already
    booked elsewhere, just being logged here). Otherwise — Pathao only —
    `pathao_city_id`/`pathao_zone_id`/`pathao_area_id` trigger a real
    dispatch through Pathao's API (see app.services.pathao), and the
    tracking number comes back from that call instead."""
    # Lock the gift order row first so two concurrent requests for the same
    # order (e.g. a double-click) serialize instead of both passing the
    # "no existing delivery" check and both booking a real Pathao shipment.
    await db.execute(
        select(GiftOrder).where(GiftOrder.id == gift_order.id).with_for_update()
    )
    existing = (
        await db.execute(select(Delivery).where(Delivery.gift_order_id == gift_order.id))
    ).scalar_one_or_none()
    if existing is not None:
        raise ValidationAppError("This gift order already has a delivery.")

    final_tracking_number = tracking_number
    if final_tracking_number is None:
        assert pathao_city_id and pathao_zone_id and pathao_area_id
        assert recipient_name and recipient_phone
        order = await pathao_service.dispatch_pathao_order(
            db,
            recipient_name=recipient_name,
            recipient_phone=recipient_phone,
            recipient_address=address,
            city_id=pathao_city_id,
            zone_id=pathao_zone_id,
            area_id=pathao_area_id,
            merchant_order_id=str(gift_order.public_id),
            item_description=gift_order.gift_name,
        )
        final_tracking_number = order.consignment_id

    delivery = Delivery(
        gift_order_id=gift_order.id,
        courier=courier,
        tracking_number=final_tracking_number,
        address=address,
        city=city,
        estimated_delivery=estimated_delivery,
    )
    db.add(delivery)
    await db.commit()
    await db.refresh(delivery)
    return delivery


async def update_delivery_status(
    db: AsyncSession, delivery: Delivery, *, status: str, notes: str | None
) -> Delivery:
    delivery.status = status
    if status == DeliveryStatus.DELIVERED.value:
        delivery.delivered_at = datetime.now(UTC)
    if notes is not None:
        delivery.notes = notes

    await db.commit()
    await db.refresh(delivery)
    return delivery
