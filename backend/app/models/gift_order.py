import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.customer import Customer


class GiftOccasion(str, enum.Enum):
    BIRTHDAY = "BIRTHDAY"
    VIP_REWARD = "VIP_REWARD"
    LOYALTY_MILESTONE = "LOYALTY_MILESTONE"


class GiftOrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    SCHEDULED = "SCHEDULED"
    SENT = "SENT"
    CANCELLED = "CANCELLED"


class GiftOrder(Base):
    """A gift queued (and eventually sent) to a customer. `gift_name` is
    snapshotted from the `GiftCatalogItem` at creation time — same
    reasoning as `CampaignRecipient.name`/`.phone` — so this order's
    history stays accurate even if the catalog item is later edited or
    deleted (`catalog_item_id` goes null on delete, everything else about
    the order is unaffected).

    `notification_error` is set only if the SMS sent on `send_gift_order`
    fails — `status` still becomes `SENT` regardless, since the gift
    itself was handed over; the notification is a courtesy, not the fact
    being tracked.

    `delivery_address` is captured once, at order creation (defaulting to
    the customer's saved `Customer.address` in the UI, editable per
    recipient) — separate from `Delivery.address`, which is a snapshot
    taken later, only for orders that actually go out via courier. Not
    every gift order becomes a Delivery, so this field stays optional.

    `wish_text` overrides the fixed "gift sent" SMS template for this one
    order — typed by the admin at queue time (see
    render_gift_sms_message). Null means "use the default template"."""

    __tablename__ = "gift_orders"
    __table_args__ = (Index("ix_gift_orders_customer_id", "customer_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=False, default=uuid.uuid4
    )

    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    customer: Mapped[Customer] = relationship(lazy="selectin")
    catalog_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("gift_catalog_items.id", ondelete="SET NULL"), nullable=True
    )
    gift_name: Mapped[str] = mapped_column(String(255), nullable=False)

    occasion: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=GiftOrderStatus.PENDING.value,
        server_default=GiftOrderStatus.PENDING.value,
        index=True,
    )

    delivery_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    wish_text: Mapped[str | None] = mapped_column(String(500), nullable=True)

    scheduled_for: Mapped[date | None] = mapped_column(Date, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notification_error: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
