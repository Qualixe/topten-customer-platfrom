from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class CustomerMonthlySpending(Base):
    """
    One row per (customer, calendar month). The unique constraint below is
    what makes re-importing the same month's POS file safe: the import
    pipeline always upserts on (customer_id, year, month), so a repeat
    import replaces this row's `amount` rather than adding a second row —
    Customer.total_spent is then recalculated as SUM(amount) across these
    rows, never incremented, so it can never be double-counted either.
    """

    __tablename__ = "customer_monthly_spending"
    __table_args__ = (
        UniqueConstraint("customer_id", "year", "month", name="uq_monthly_spending_period"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    import_batch_id: Mapped[int | None] = mapped_column(
        ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
