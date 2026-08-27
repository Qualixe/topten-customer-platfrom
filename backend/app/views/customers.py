from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.customer import CustomerType


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
    profile_status: Literal["COMPLETE", "INCOMPLETE"]
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
    email: str | None
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


class VipCustomerRead(BaseModel):
    """A customer flagged `is_vip`, enriched with a derived engagement status.

    `customer_type` is the customer's separate POS-import-driven segment
    (GENERAL/VIP/VVIP) — it isn't kept in sync with `is_vip` (a customer can
    be manually flagged VIP while still POS-classified GENERAL), so it's
    surfaced here as-is rather than treated as a "VIP level" of the flag.

    `status` is computed, not stored: ACTIVE unless the customer's
    administrative `Customer.status` isn't "active" (-> INACTIVE), or their
    most recent non-zero `customer_monthly_spending` row is more than two
    calendar months old (-> AT_RISK). `last_purchase_year`/`_month` reflect
    that same most-recent spending row and are both null if the customer
    has no recorded spending history yet.
    """

    id: UUID
    name: str
    email: str | None
    phone: str
    address: str | None
    customer_type: CustomerType
    status: Literal["ACTIVE", "AT_RISK", "INACTIVE"]
    total_spent: Decimal
    last_purchase_year: int | None
    last_purchase_month: int | None
    member_since: datetime


class VipCustomersListResponse(BaseModel):
    success: bool = True
    data: list[VipCustomerRead]
    meta: CustomersMeta


class VipCustomerStats(BaseModel):
    total_vip_customers: int
    total_vip_revenue: Decimal
    average_spend: Decimal
    at_risk_count: int


class VipCustomerStatsResponse(BaseModel):
    success: bool = True
    data: VipCustomerStats
    meta: dict = {}


class VerifiedCustomerRead(BaseModel):
    """One row per (customer, campaign) the customer verified through — see
    app.controllers.customers.list_verified_customers. A customer who
    verified through two campaigns appears here twice, once per campaign;
    the underlying Customer row is never duplicated."""

    id: UUID
    name: str
    phone: str
    campaign_id: UUID
    campaign_name: str
    customer_type: CustomerType
    verified_at: datetime
    date_of_birth: date | None
    address: str | None
    email: str | None


class VerifiedCustomersListResponse(BaseModel):
    success: bool = True
    data: list[VerifiedCustomerRead]
    meta: CustomersMeta
