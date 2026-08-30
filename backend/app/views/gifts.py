from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.delivery import CourierProvider
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
    delivery_address: str | None = None
    wish_text: str | None = None

    @field_validator("delivery_address", "wish_text")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class GiftOrderRecipient(BaseModel):
    """One recipient in a bulk send — `delivery_address`/`wish_text` are
    always optional. `courier` opts this recipient into also getting a
    `Delivery` created in the same request (see
    app.controllers.gifts.create_gift_orders_bulk_endpoint) — when set,
    `city` and `delivery_address` become required, and shipping is fulfilled
    one of two ways: set `tracking_number` for a shipment already booked
    elsewhere, or (Pathao only) leave it unset and set
    `pathao_city_id`/`pathao_zone_id`/`pathao_area_id` plus
    `recipient_name`/`recipient_phone` to dispatch through Pathao's real API —
    same two paths as `DeliveryCreate` (see app.views.deliveries)."""

    customer_id: UUID
    delivery_address: str | None = None
    wish_text: str | None = None
    courier: CourierProvider | None = None
    tracking_number: str | None = None
    city: str | None = None
    estimated_delivery: date | None = None

    pathao_city_id: int | None = None
    pathao_zone_id: int | None = None
    pathao_area_id: int | None = None
    recipient_name: str | None = None
    recipient_phone: str | None = None

    @field_validator(
        "delivery_address",
        "wish_text",
        "tracking_number",
        "city",
        "recipient_name",
        "recipient_phone",
    )
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @model_validator(mode="after")
    def _courier_requires_shipping_details(self) -> "GiftOrderRecipient":
        if self.courier is None:
            return self

        if not (self.city and self.delivery_address):
            raise ValueError(
                "delivery_address and city are required when a courier is selected"
            )

        has_pathao_dispatch = bool(
            self.pathao_city_id and self.pathao_zone_id and self.pathao_area_id
        )
        if not self.tracking_number and not has_pathao_dispatch:
            raise ValueError(
                "Provide a tracking number, or (Pathao only) select a city/zone/area to "
                "dispatch automatically."
            )
        if has_pathao_dispatch:
            if self.courier != CourierProvider.PATHAO:
                raise ValueError("Automatic dispatch is only available for Pathao.")
            if not self.recipient_name or not self.recipient_phone:
                raise ValueError(
                    "recipient_name and recipient_phone are required to dispatch via Pathao."
                )
        return self


class BulkGiftOrderCreate(BaseModel):
    """POST /gifts/orders/bulk — one gift, one occasion, sent to several
    customers at once. Each recipient can carry their own delivery address
    (or none) independently of the others."""

    recipients: list[GiftOrderRecipient] = Field(min_length=1, max_length=100)
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
    occasion: GiftOccasion
    status: GiftOrderStatus
    delivery_address: str | None
    wish_text: str | None
    scheduled_for: date | None
    sent_at: datetime | None
    notification_error: str | None
    created_at: datetime


class GiftOrderResponse(BaseModel):
    success: bool = True
    data: GiftOrderRead
    meta: dict = {}


class BulkGiftOrdersResponse(BaseModel):
    success: bool = True
    data: list[GiftOrderRead]
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
