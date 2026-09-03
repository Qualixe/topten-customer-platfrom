import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CustomerType(Base):
    """An admin-managed customer type/label (e.g. General, VIP, VVIP, or any
    new one an admin adds). Purely a labeling/filtering concept — not to be
    confused with `Customer.is_vip` (a separate, unrelated flag the VIP
    Customers page and segments actually key off).

    `is_system=True` marks the three rows seeded when this table replaced
    the old fixed CustomerType enum (General/VIP/VVIP). Those three can
    never be renamed, deactivated, or deleted (see app.services.customer_types)
    because SMS campaign audience targeting resolves them by exact name (see
    app.services.sms_campaigns_audience) and deliberately does NOT extend
    to arbitrary admin-added types. Admin-created rows (is_system=False)
    have no such restriction.

    There is no delete for any row, system or admin-created — only
    `is_active`. A type stays permanently referenceable by history (existing
    customers/import batches keep pointing at it) even after an admin
    retires it; `is_active=False` just hides it from pickers for *new*
    assignments going forward."""

    __tablename__ = "customer_types"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=False, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    is_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
