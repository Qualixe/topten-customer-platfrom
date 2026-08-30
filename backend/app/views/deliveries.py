from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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
    """Two ways to fill in `tracking_number`:

    - Manually: you already booked this shipment yourself (e.g. on
      Pathao's own dashboard, or with any other courier) and just want to
      log the tracking number here — set `tracking_number`.
    - Live Pathao dispatch: leave `tracking_number` unset and instead set
      `pathao_city_id`/`pathao_zone_id`/`pathao_area_id` (from the
      cascading pickers, see GET /couriers/pathao/cities etc.) plus
      `recipient_name`/`recipient_phone` — this calls Pathao's real API to
      create the shipment and fills `tracking_number` in from its
      response. Only valid when `courier` is PATHAO.
    """

    gift_order_id: UUID
    courier: CourierProvider
    address: str = Field(min_length=1, max_length=500)
    city: str = Field(min_length=1, max_length=100)
    estimated_delivery: date | None = None

    tracking_number: str | None = Field(default=None, max_length=100)

    pathao_city_id: int | None = None
    pathao_zone_id: int | None = None
    pathao_area_id: int | None = None
    recipient_name: str | None = Field(default=None, max_length=255)
    recipient_phone: str | None = Field(default=None, max_length=32)

    @field_validator("tracking_number", "address", "city", "recipient_name", "recipient_phone")
    @classmethod
    def _not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("This field cannot be blank")
        return stripped

    @model_validator(mode="after")
    def _require_tracking_or_pathao_dispatch(self) -> "DeliveryCreate":
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
