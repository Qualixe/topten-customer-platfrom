import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GiftCategory(Base):
    """An admin-managed gift category. Unlike a fixed enum, these are
    created/renamed/deleted at runtime (see `app.services.gifts`), so the
    catalog isn't stuck with a hardcoded list. Deleting a category in use
    by any `GiftCatalogItem` is rejected at the service layer rather than
    relying on the DB-level RESTRICT below to surface a clean error."""

    __tablename__ = "gift_categories"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=False, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
