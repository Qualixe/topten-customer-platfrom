from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.database.models.customer import CustomerType


class CustomerCreate(BaseModel):
    """Request body for POST /api/v1/customers (manual add, outside imports)."""

    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=1)
    email: str | None = None
    address: str | None = None
    date_of_birth: date | None = None
    is_vip: bool = False

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be blank")
        return stripped

    @field_validator("email", "address")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class CustomerRead(BaseModel):
    """Public shape of a Customer row. `id` is the public UUID, never the
    internal auto-increment primary key."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(validation_alias="public_id")
    name: str
    phone: str
    email: str | None
    address: str | None
    date_of_birth: date | None
    is_vip: bool
    customer_type: CustomerType
    total_spent: Decimal
    status: str
    created_at: datetime


class CustomerUpdate(BaseModel):
    """PATCH body for updating a customer. Every field is optional — only
    fields actually present in the request body are changed (see
    `model_dump(exclude_unset=True)` in the endpoint); an omitted field is
    left as-is, while a field explicitly sent as null clears it."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, min_length=1)
    email: str | None = None
    address: str | None = None
    date_of_birth: date | None = None
    is_vip: bool | None = None
    status: str | None = None

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be blank")
        return stripped

    @field_validator("email", "address")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class CustomerCreateResponse(BaseModel):
    success: bool = True
    data: CustomerRead
    meta: dict = {}


class CustomersMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class CustomersListResponse(BaseModel):
    """Shape: {"success": true, "data": [...], "meta": {...}}."""

    success: bool = True
    data: list[CustomerRead]
    meta: CustomersMeta


class CustomerStats(BaseModel):
    total_customers: int
    vip_customers: int
    birthdays_this_month: int
    total_revenue: Decimal


class CustomerStatsResponse(BaseModel):
    success: bool = True
    data: CustomerStats
    meta: dict = {}


class UpcomingBirthday(BaseModel):
    id: UUID
    name: str
    is_vip: bool
    date: date
    days_away: int


class UpcomingBirthdaysResponse(BaseModel):
    success: bool = True
    data: list[UpcomingBirthday]
    meta: dict = {}


class CustomerProfileTokenIssued(BaseModel):
    token: str
    expires_at: datetime


class CustomerProfileTokenResponse(BaseModel):
    """Shape of POST /api/v1/customers/{id}/profile-token — the admin-side
    action that mints the secure link for /customer/{token}."""

    success: bool = True
    data: CustomerProfileTokenIssued
    meta: dict = {}
