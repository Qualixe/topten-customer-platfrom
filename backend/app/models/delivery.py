import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.gift_order import GiftOrder


class DeliveryStatus(str, enum.Enum):
    PENDING_PICKUP = "PENDING_PICKUP"
    IN_TRANSIT = "IN_TRANSIT"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"
    RETURNED = "RETURNED"


class CourierProvider(str, enum.Enum):
    PATHAO = "PATHAO"
    REDX = "REDX"
    PAPERFLY = "PAPERFLY"
    SUNDARBAN_COURIER = "SUNDARBAN_COURIER"
    ECOURIER = "ECOURIER"


class Delivery(Base):
    """A courier shipment for one `GiftOrder` — one delivery per order (the
    unique `gift_order_id`), created when staff hand a gift to a courier
    rather than at gift-order creation time (not every gift order ships via
    courier). `address`/`city` are captured at that moment rather than
    joined live from `Customer.address` (one unstructured field with no
    separate city) — a snapshot, same reasoning `GiftOrder.gift_name`/
    `CampaignRecipient.name` already use elsewhere in this codebase.

    Status here is the courier's delivery pipeline (PENDING_PICKUP -> ... ->
    DELIVERED/FAILED/RETURNED) and is completely separate from the
    `GiftOrder.status` lifecycle (PENDING/SCHEDULED/SENT/CANCELLED) — a gift
    order being SENT (its SMS notification went out) says nothing about
    whether the physical item has arrived yet."""

    __tablename__ = "deliveries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=False, default=uuid.uuid4
    )

    gift_order_id: Mapped[int] = mapped_column(
        ForeignKey("gift_orders.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    gift_order: Mapped[GiftOrder] = relationship(lazy="selectin")

    courier: Mapped[str] = mapped_column(String(30), nullable=False)
    tracking_number: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=DeliveryStatus.PENDING_PICKUP.value,
        server_default=DeliveryStatus.PENDING_PICKUP.value,
        index=True,
    )

    address: Mapped[str] = mapped_column(String(500), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)

    dispatched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    estimated_delivery: Mapped[date | None] = mapped_column(Date, nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
