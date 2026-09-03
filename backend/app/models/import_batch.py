import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.customer_type import CustomerType


class ImportBatchStatus(str, enum.Enum):
    UPLOADED = "UPLOADED"
    VALIDATING = "VALIDATING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    COMPLETED_WITH_ERRORS = "COMPLETED_WITH_ERRORS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class ImportBatch(Base):
    """
    Tracks one monthly POS import file end to end. `public_id` is the
    identifier exposed over the API (`import_id`); `id`/`file_path` are
    internal. `processed_rows` and `file_path` aren't in the task's literal
    field list but are required to serve import-progress polling and to let
    the Celery task locate the stored upload — see
    app.views.imports.ImportBatchRead for the API-facing shape.
    """

    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=False, default=uuid.uuid4
    )

    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)

    period_year: Mapped[int] = mapped_column(Integer, nullable=False)
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)

    # The customer type this whole file was uploaded as (e.g. a "VIP"
    # POS export) — every row in the file is imported/updated under this
    # single type. Required at upload time.
    customer_type_id: Mapped[int] = mapped_column(
        ForeignKey("customer_types.id", ondelete="RESTRICT"), nullable=False
    )
    customer_type: Mapped[CustomerType] = relationship(lazy="selectin")

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=ImportBatchStatus.UPLOADED.value,
        server_default=ImportBatchStatus.UPLOADED.value,
    )

    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    processed_rows: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    new_customers: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    updated_customers: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    duplicate_rows: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    invalid_rows: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    total_spending: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0"), server_default="0"
    )

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
