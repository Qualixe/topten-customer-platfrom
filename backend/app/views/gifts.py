from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.gift_order import GiftOccasion, GiftOrderStatus


class GiftCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Category name cannot be blank")
        return stripped


class GiftCategoryUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=50)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Category name cannot be blank")
        return stripped


class GiftCategoryRead(BaseModel):
    id: UUID
    name: str


class GiftCategoryResponse(BaseModel):
    success: bool = True
    data: GiftCategoryRead
    meta: dict = {}


class GiftCategoriesListResponse(BaseModel):
    success: bool = True
    data: list[GiftCategoryRead]
    meta: dict = {}


class GiftCatalogItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    category_id: UUID
    description: str = ""
    points_cost: int = Field(ge=0)
    retail_value: Decimal = Field(ge=0)
    stock_quantity: int = Field(ge=0, default=0)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be blank")
        return stripped


class GiftCatalogItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category_id: UUID | None = None
    description: str | None = None
    points_cost: int | None = Field(default=None, ge=0)
    retail_value: Decimal | None = Field(default=None, ge=0)
    stock_quantity: int | None = Field(default=None, ge=0)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be blank")
        return stripped


class GiftCatalogItemRead(BaseModel):
    id: UUID
    name: str
    category: GiftCategoryRead
    description: str
    image_url: str | None
    points_cost: int
    retail_value: Decimal
    stock_quantity: int
    stock_status: str
    times_redeemed: int
    created_at: datetime


class GiftCatalogItemResponse(BaseModel):
    success: bool = True
    data: GiftCatalogItemRead
    meta: dict = {}


class GiftCatalogMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class GiftCatalogListResponse(BaseModel):
    success: bool = True
    data: list[GiftCatalogItemRead]
    meta: GiftCatalogMeta


class GiftOrderCreate(BaseModel):
    customer_id: UUID
    catalog_item_id: UUID
    occasion: GiftOccasion


class GiftOrderUpdate(BaseModel):
    """PATCH body for advancing (or cancelling) a gift order. `scheduled_for`
    is required when `status` is `SCHEDULED`, ignored otherwise."""

    status: GiftOrderStatus
    scheduled_for: date | None = None


class GiftOrderCustomer(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(validation_alias="public_id")
    name: str
    is_vip: bool


class GiftOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(validation_alias="public_id")
    customer: GiftOrderCustomer
    gift_name: str
    points_cost: int
    occasion: GiftOccasion
    status: GiftOrderStatus
    scheduled_for: date | None
    sent_at: datetime | None
    notification_error: str | None
    created_at: datetime


class GiftOrderResponse(BaseModel):
    success: bool = True
    data: GiftOrderRead
    meta: dict = {}


class GiftOrdersMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class GiftOrdersListResponse(BaseModel):
    success: bool = True
    data: list[GiftOrderRead]
    meta: GiftOrdersMeta


class GiftStats(BaseModel):
    total_gifts_in_catalog: int
    pending_orders_count: int
    scheduled_orders_count: int
    sent_orders_count: int


class GiftStatsResponse(BaseModel):
    success: bool = True
    data: GiftStats
    meta: dict = {}
