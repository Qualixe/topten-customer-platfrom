from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models.import_batch import ImportBatchStatus
from app.views.customers import CustomerTypeRead


class ImportBatchCreateData(BaseModel):
    import_id: UUID
    status: ImportBatchStatus
    customer_type: CustomerTypeRead


class ImportBatchCreateResponse(BaseModel):
    """Shape matches the task's example exactly:
    {"success": true, "data": {"import_id": "...", "status": "UPLOADED"}}
    """

    success: bool = True
    data: ImportBatchCreateData


class ImportBatchRead(BaseModel):
    """Full progress detail for GET /imports/{id} and each row of GET /imports."""

    model_config = ConfigDict(from_attributes=True)

    import_id: UUID = Field(validation_alias="public_id")
    file_name: str
    period_year: int
    period_month: int
    customer_type: CustomerTypeRead
    status: ImportBatchStatus

    total_rows: int
    processed_rows: int
    new_customers: int
    updated_customers: int
    duplicate_rows: int
    invalid_rows: int
    total_spending: Decimal

    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def progress_percentage(self) -> float:
        if self.total_rows <= 0:
            return 0.0
        return round(min(self.processed_rows, self.total_rows) / self.total_rows * 100, 2)


class ImportBatchReadResponse(BaseModel):
    success: bool = True
    data: ImportBatchRead


class ImportBatchListResponse(BaseModel):
    success: bool = True
    data: list[ImportBatchRead]
    total: int


class ImportRowErrorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    row_number: int
    error_message: str
    raw_row: dict[str, str]


class ImportRowErrorListResponse(BaseModel):
    success: bool = True
    data: list[ImportRowErrorRead]
    total: int
