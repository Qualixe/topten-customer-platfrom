import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.gift_category import GiftCategory


class StockStatus(str, enum.Enum):
    IN_STOCK = "IN_STOCK"
    LOW_STOCK = "LOW_STOCK"
    OUT_OF_STOCK = "OUT_OF_STOCK"


LOW_STOCK_THRESHOLD = 10


class GiftCatalogItem(Base):
    """One redeemable item in the gift catalog. `stock_quantity` and
    `times_redeemed` are live counters, adjusted when a `GiftOrder` against
    this item is sent (see `app.services.gifts.send_gift_order`) — "stock
    status" (In Stock / Low Stock / Out of Stock) is derived from
    `stock_quantity` at the API layer rather than stored here, so it can
    never drift out of sync with the count itself."""

    __tablename__ = "gift_catalog_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=False, default=uuid.uuid4
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("gift_categories.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    category: Mapped[GiftCategory] = relationship(lazy="selectin")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    retail_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    stock_quantity: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    times_redeemed: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    @property
    def stock_status(self) -> str:
        if self.stock_quantity <= 0:
            return StockStatus.OUT_OF_STOCK.value
        if self.stock_quantity < LOW_STOCK_THRESHOLD:
            return StockStatus.LOW_STOCK.value
        return StockStatus.IN_STOCK.value
