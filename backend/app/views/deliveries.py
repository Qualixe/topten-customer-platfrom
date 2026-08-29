from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.delivery import CourierProvider, DeliveryStatus
from app.models.gift_order import GiftOrderStatus

__all__ = [
    "CourierProvider",
    "DeliveryStatus",
    "DeliveryCustomer",
    "DeliveryGiftOrder",
    "DeliveryRead",
    "DeliveryResponse",
    "DeliveriesMeta",
    "DeliveriesListResponse",
    "DeliveryStats",
    "DeliveryStatsResponse",
    "DeliveryCreate",
    "DeliveryStatusUpdate",
    "EligibleGiftOrder",
    "EligibleGiftOrdersMeta",
    "EligibleGiftOrdersListResponse",
]


class DeliveryCustomer(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(validation_alias="public_id")
    name: str
    is_vip: bool


class DeliveryGiftOrder(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(validation_alias="public_id")
    gift_name: str
    customer: DeliveryCustomer


class DeliveryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(validation_alias="public_id")
    gift_order: DeliveryGiftOrder
    courier: CourierProvider
    tracking_number: str
    status: DeliveryStatus
    address: str
    city: str
    dispatched_at: datetime
    estimated_delivery: date | None
    delivered_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class DeliveryResponse(BaseModel):
    success: bool = True
    data: DeliveryRead
    meta: dict = {}


class DeliveriesMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class DeliveriesListResponse(BaseModel):
    success: bool = True
    data: list[DeliveryRead]
    meta: DeliveriesMeta


class DeliveryStats(BaseModel):
    total: int
    in_transit: int
    delivered: int
    issues: int


class DeliveryStatsResponse(BaseModel):
    success: bool = True
    data: DeliveryStats
    meta: dict = {}


class DeliveryCreate(BaseModel):
    gift_order_id: UUID
    courier: CourierProvider
    tracking_number: str = Field(min_length=1, max_length=100)
    address: str = Field(min_length=1, max_length=500)
    city: str = Field(min_length=1, max_length=100)
    estimated_delivery: date | None = None

    @field_validator("tracking_number", "address", "city")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("This field cannot be blank")
        return stripped


class DeliveryStatusUpdate(BaseModel):
    status: DeliveryStatus
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("notes")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class EligibleGiftOrder(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(validation_alias="public_id")
    gift_name: str
    status: GiftOrderStatus
    customer: DeliveryCustomer


class EligibleGiftOrdersMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class EligibleGiftOrdersListResponse(BaseModel):
    success: bool = True
    data: list[EligibleGiftOrder]
    meta: EligibleGiftOrdersMeta
