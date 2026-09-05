import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.customer_type import CustomerType


class CustomerStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class Customer(Base):
    """
    Customer master record. `normalized_phone` (E.164, via app.common.phone)
    is the sole identity key for matching against POS imports — never `name`.

    `date_of_birth`, `address`, `city`, and `email` are customer-submitted
    fields (e.g. a future promotional SMS profile form). POS imports must
    never overwrite them with blank values; see
    app.services.imports.upsert_customers, whose upsert `SET` clause
    deliberately excludes these columns.
    """

    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=False, default=uuid.uuid4
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    normalized_phone: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, nullable=False
    )

    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)

    is_vip: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    # Marketing consent — off by default, never set implicitly. Only a
    # customer with this True is eligible to be synced into a configured
    # marketing provider's audience (see app.services.sendgrid_sync and
    # app.services.mailchimp_sync); nothing in this app infers consent from
    # being an existing customer.
    marketing_opt_in: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    marketing_opt_in_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # SendGrid-specific: also gates SendGrid campaign eligibility (see
    # create_campaign_draft), which Mailchimp has no equivalent of — kept
    # separate from mailchimp_synced_at below rather than shared, so syncing
    # to one provider never looks like sync status for the other.
    marketing_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    mailchimp_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    customer_type_id: Mapped[int] = mapped_column(
        ForeignKey("customer_types.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    customer_type: Mapped[CustomerType] = relationship(lazy="selectin")
    total_spent: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=CustomerStatus.ACTIVE.value,
        server_default=CustomerStatus.ACTIVE.value,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    @property
    def profile_status(self) -> str:
        """COMPLETE once a customer has filled in DOB, address, and email —
        typically via the public profile form. A POS import alone can never
        make this COMPLETE, since it never touches these three fields."""
        if self.date_of_birth and self.address and self.email:
            return "COMPLETE"
        return "INCOMPLETE"


# Partial indexes for the "missing DOB" / "missing address" campaign audience
# filters — declared after the class body so they can reference the mapped
# columns directly. At millions of rows these are far more selective (and
# smaller) than a full-column btree index, since only NULL rows are indexed.
Index(
    "ix_customers_missing_dob",
    Customer.id,
    postgresql_where=Customer.date_of_birth.is_(None),
)
Index(
    "ix_customers_missing_address",
    Customer.id,
    postgresql_where=Customer.address.is_(None),
)
