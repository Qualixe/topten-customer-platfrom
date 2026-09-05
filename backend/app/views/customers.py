from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CustomerTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Customer type name cannot be blank")
        return stripped


class CustomerTypeUpdate(BaseModel):
    """PATCH body for renaming and/or toggling a customer type active. Both
    fields are optional — send just the one being changed. There is no
    delete; `is_active=False` is how a type is retired."""

    name: str | None = Field(default=None, min_length=1, max_length=50)
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Customer type name cannot be blank")
        return stripped


class CustomerTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    # populate_by_name so this validates both ways: from_attributes off an
    # ORM CustomerType object (which has no `.id: UUID` — only `.public_id`,
    # hence the alias) when nested inside CustomerRead/VipCustomerRead/etc,
    # and via a direct `CustomerTypeRead(id=..., ...)` call (the pattern
    # used everywhere this is built by hand — see e.g.
    # app.controllers.customers._customer_type_to_read).
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: UUID = Field(validation_alias="public_id")
    name: str
    is_system: bool
    is_active: bool


class CustomerTypeResponse(BaseModel):
    success: bool = True
    data: CustomerTypeRead
    meta: dict = {}


class CustomerTypesListResponse(BaseModel):
    success: bool = True
    data: list[CustomerTypeRead]
    meta: dict = {}


class CustomerCreate(BaseModel):
    """Request body for POST /api/v1/customers (manual add, outside imports)."""

    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=1)
    email: str | None = None
    address: str | None = None
    city: str | None = None
    date_of_birth: date | None = None
    is_vip: bool = False
    marketing_opt_in: bool = False
    # Optional — omitted defaults to the built-in "General" type server-side
    # (see app.controllers.customers.create_customer), matching the old
    # fixed-enum column's default before customer types became admin-editable.
    customer_type_id: UUID | None = None

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be blank")
        return stripped

    @field_validator("email", "address", "city")
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
    city: str | None
    date_of_birth: date | None
    is_vip: bool
    marketing_opt_in: bool
    marketing_opt_in_at: datetime | None
    marketing_synced_at: datetime | None
    customer_type: CustomerTypeRead
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
    city: str | None = None
    date_of_birth: date | None = None
    is_vip: bool | None = None
    marketing_opt_in: bool | None = None
    status: str | None = None
    customer_type_id: UUID | None = None

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be blank")
        return stripped

    @field_validator("email", "address", "city")
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


class SegmentBucket(BaseModel):
    """One populated value within a segment dimension, e.g. `{"value":
    "active", "label": "Active", "count": 42}` for the "by status"
    dimension. Values with zero customers are omitted entirely rather than
    listed with a 0 count."""

    value: str
    label: str
    count: int


class CustomerSegments(BaseModel):
    """Breakdowns the data actually supports today. `by_customer_type`
    groups by the admin-manageable customer type (see
    app.models.customer_type) — the dimension campaigns, gifts, and the
    customer list all filter by. `Customer.city` exists in the schema now
    but has no breakdown here yet; `by_gender`, `by_group`, and `by_tag`
    aren't in the schema at all — the frontend shows all of those as "No
    data yet" rather than this endpoint returning empty lists for them."""

    by_status: list[SegmentBucket]
    by_customer_type: list[SegmentBucket]


class CustomerSegmentsResponse(BaseModel):
    success: bool = True
    data: CustomerSegments
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
    """A customer whose `customer_type` is the built-in VIP or VVIP type
    (see app.services.customer_types.get_vip_tier_type_ids), enriched with a
    derived engagement status. Independent of the separate `is_vip` flag
    manual overrides use elsewhere — this page is specifically about the
    VIP/VVIP customer type, not that flag.

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
    city: str | None
    customer_type: CustomerTypeRead
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
    customer_type: CustomerTypeRead
    verified_at: datetime
    date_of_birth: date | None
    address: str | None
    email: str | None


class VerifiedCustomersListResponse(BaseModel):
    success: bool = True
    data: list[VerifiedCustomerRead]
    meta: CustomersMeta
