from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import (
    PlainFieldStatus,
    SecretFieldStatus,
    get_or_create_credential_row,
    merge_credential_data,
)
from app.common.dependencies import get_db, require_permission
from app.common.exceptions import NotFoundError
from app.services import deliveries as service
from app.services import gifts as gifts_service
from app.views.couriers import (
    PathaoCredentialsResponse,
    PathaoCredentialsStatus,
    PathaoCredentialsUpdate,
)
from app.views.deliveries import (
    DeliveriesListResponse,
    DeliveriesMeta,
    DeliveryCreate,
    DeliveryRead,
    DeliveryResponse,
    DeliveryStats,
    DeliveryStatsResponse,
    DeliveryStatusUpdate,
    EligibleGiftOrder,
    EligibleGiftOrdersListResponse,
    EligibleGiftOrdersMeta,
)

router = APIRouter()

PATHAO_PROVIDER = "pathao"


def _to_status(data: dict[str, str | None]) -> PathaoCredentialsStatus:
    return PathaoCredentialsStatus(
        client_id=PlainFieldStatus(value=data.get("client_id")),
        client_secret=SecretFieldStatus(is_set=bool(data.get("client_secret"))),
        username=PlainFieldStatus(value=data.get("username")),
        password=SecretFieldStatus(is_set=bool(data.get("password"))),
    )


@router.get("/pathao/credentials", response_model=PathaoCredentialsResponse)
async def get_pathao_credentials(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("couriers.manage")),
) -> PathaoCredentialsResponse:
    row = await get_or_create_credential_row(db, PATHAO_PROVIDER)
    return PathaoCredentialsResponse(data=_to_status(row.data))


@router.put("/pathao/credentials", response_model=PathaoCredentialsResponse)
async def update_pathao_credentials(
    payload: PathaoCredentialsUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("couriers.manage")),
) -> PathaoCredentialsResponse:
    updates = payload.model_dump(exclude_unset=True)
    data = await merge_credential_data(db, PATHAO_PROVIDER, updates)
    return PathaoCredentialsResponse(data=_to_status(data))


# Static path segments are registered before "/{delivery_id}" for the same
# reason app.controllers.sms_campaigns does it — a request to
# /deliveries/eligible-gift-orders would otherwise be swallowed by the
# dynamic route and fail UUID parsing instead of reaching the right one.
@router.get("/deliveries/eligible-gift-orders", response_model=EligibleGiftOrdersListResponse)
async def get_eligible_gift_orders(
    search: str = Query(""),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("couriers.manage")),
) -> EligibleGiftOrdersListResponse:
    """Gift orders with no delivery yet — source for the "create delivery"
    picker. Nothing is created here."""
    orders, total = await service.list_eligible_gift_orders(db, search, page, page_size)
    total_pages = max(1, -(-total // page_size))

    return EligibleGiftOrdersListResponse(
        data=[EligibleGiftOrder.model_validate(order) for order in orders],
        meta=EligibleGiftOrdersMeta(
            page=page, page_size=page_size, total=total, total_pages=total_pages
        ),
    )


@router.get("/deliveries/stats", response_model=DeliveryStatsResponse)
async def get_delivery_stats(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("couriers.view")),
) -> DeliveryStatsResponse:
    stats: DeliveryStats = await service.get_delivery_stats(db)
    return DeliveryStatsResponse(data=stats)


@router.get("/deliveries", response_model=DeliveriesListResponse)
async def list_deliveries(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    courier: str | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None, description="Matches tracking number or customer name"),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("couriers.view")),
) -> DeliveriesListResponse:
    items, total = await service.list_deliveries(
        db, page, page_size, courier=courier, status=status, search=search
    )
    total_pages = max(1, -(-total // page_size))

    return DeliveriesListResponse(
        data=[DeliveryRead.model_validate(item) for item in items],
        meta=DeliveriesMeta(page=page, page_size=page_size, total=total, total_pages=total_pages),
    )


@router.post(
    "/deliveries", response_model=DeliveryResponse, status_code=http_status.HTTP_201_CREATED
)
async def create_delivery(
    payload: DeliveryCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("couriers.manage")),
) -> DeliveryResponse:
    gift_order = await gifts_service.get_gift_order_or_404(db, payload.gift_order_id)

    delivery = await service.create_delivery(
        db,
        gift_order_id=gift_order.id,
        courier=payload.courier.value,
        tracking_number=payload.tracking_number,
        address=payload.address,
        city=payload.city,
        estimated_delivery=payload.estimated_delivery,
    )
    return DeliveryResponse(data=DeliveryRead.model_validate(delivery))


@router.patch("/deliveries/{delivery_id}", response_model=DeliveryResponse)
async def update_delivery_status(
    delivery_id: UUID,
    payload: DeliveryStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("couriers.manage")),
) -> DeliveryResponse:
    delivery = await service.get_delivery_by_public_id(db, delivery_id)
    if delivery is None:
        raise NotFoundError("Delivery not found")

    delivery = await service.update_delivery_status(
        db, delivery, status=payload.status.value, notes=payload.notes
    )
    return DeliveryResponse(data=DeliveryRead.model_validate(delivery))
