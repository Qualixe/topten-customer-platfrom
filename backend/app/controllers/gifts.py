from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db, require_permission
from app.common.exceptions import ValidationAppError
from app.models.gift_catalog_item import GiftCatalogItem
from app.models.gift_order import GiftOrder, GiftOrderStatus
from app.services.gifts import (
    cancel_gift_order,
    create_catalog_item,
    create_gift_order,
    delete_catalog_item,
    get_catalog_item_or_404,
    get_gift_order_or_404,
    schedule_gift_order,
    send_gift_order,
    update_catalog_item,
)
from app.views.gifts import (
    GiftCatalogItemCreate,
    GiftCatalogItemRead,
    GiftCatalogItemResponse,
    GiftCatalogItemUpdate,
    GiftCatalogListResponse,
    GiftCatalogMeta,
    GiftOrderCreate,
    GiftOrderRead,
    GiftOrderResponse,
    GiftOrdersListResponse,
    GiftOrdersMeta,
    GiftOrderUpdate,
    GiftStats,
    GiftStatsResponse,
)

router = APIRouter()


@router.get("/catalog", response_model=GiftCatalogListResponse)
async def list_catalog(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.view")),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = Query(None),
    category: str | None = Query(None),
) -> GiftCatalogListResponse:
    filters: list[ColumnElement] = []

    search = (search or "").strip()
    if search:
        filters.append(GiftCatalogItem.name.ilike(f"%{search}%"))
    if category and category != "all":
        filters.append(GiftCatalogItem.category == category)

    count_query = select(func.count()).select_from(GiftCatalogItem)
    list_query = select(GiftCatalogItem)
    for condition in filters:
        count_query = count_query.where(condition)
        list_query = list_query.where(condition)

    total = (await db.execute(count_query)).scalar_one()

    list_query = (
        list_query.order_by(GiftCatalogItem.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await db.execute(list_query)).scalars().all()
    total_pages = max(1, -(-total // page_size))

    return GiftCatalogListResponse(
        data=[GiftCatalogItemRead.model_validate(item) for item in items],
        meta=GiftCatalogMeta(page=page, page_size=page_size, total=total, total_pages=total_pages),
    )


@router.post(
    "/catalog", response_model=GiftCatalogItemResponse, status_code=status.HTTP_201_CREATED
)
async def create_catalog_item_endpoint(
    payload: GiftCatalogItemCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.manage")),
) -> GiftCatalogItemResponse:
    item = await create_catalog_item(
        db,
        name=payload.name,
        category=payload.category,
        description=payload.description,
        points_cost=payload.points_cost,
        retail_value=payload.retail_value,
        stock_quantity=payload.stock_quantity,
    )
    return GiftCatalogItemResponse(data=GiftCatalogItemRead.model_validate(item))


@router.patch("/catalog/{item_id}", response_model=GiftCatalogItemResponse)
async def update_catalog_item_endpoint(
    item_id: UUID,
    payload: GiftCatalogItemUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.manage")),
) -> GiftCatalogItemResponse:
    item = await get_catalog_item_or_404(db, item_id)
    item = await update_catalog_item(
        db,
        item,
        name=payload.name,
        category=payload.category,
        description=payload.description,
        points_cost=payload.points_cost,
        retail_value=payload.retail_value,
        stock_quantity=payload.stock_quantity,
    )
    return GiftCatalogItemResponse(data=GiftCatalogItemRead.model_validate(item))


@router.delete("/catalog/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_catalog_item_endpoint(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.manage")),
) -> None:
    item = await get_catalog_item_or_404(db, item_id)
    await delete_catalog_item(db, item)


@router.get("/orders", response_model=GiftOrdersListResponse)
async def list_orders(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.view")),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    order_status: str | None = Query(None, alias="status"),
) -> GiftOrdersListResponse:
    filters: list[ColumnElement] = []
    if order_status and order_status != "all":
        filters.append(GiftOrder.status == order_status)

    count_query = select(func.count()).select_from(GiftOrder)
    list_query = select(GiftOrder)
    for condition in filters:
        count_query = count_query.where(condition)
        list_query = list_query.where(condition)

    total = (await db.execute(count_query)).scalar_one()

    list_query = (
        list_query.order_by(GiftOrder.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    orders = (await db.execute(list_query)).scalars().all()
    total_pages = max(1, -(-total // page_size))

    return GiftOrdersListResponse(
        data=[GiftOrderRead.model_validate(order) for order in orders],
        meta=GiftOrdersMeta(page=page, page_size=page_size, total=total, total_pages=total_pages),
    )


@router.post("/orders", response_model=GiftOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_gift_order_endpoint(
    payload: GiftOrderCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.manage")),
) -> GiftOrderResponse:
    order = await create_gift_order(
        db,
        customer_id=payload.customer_id,
        catalog_item_id=payload.catalog_item_id,
        occasion=payload.occasion,
    )
    return GiftOrderResponse(data=GiftOrderRead.model_validate(order))


@router.patch("/orders/{order_id}", response_model=GiftOrderResponse)
async def update_gift_order_endpoint(
    order_id: UUID,
    payload: GiftOrderUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.manage")),
) -> GiftOrderResponse:
    order = await get_gift_order_or_404(db, order_id)

    if payload.status == GiftOrderStatus.SCHEDULED:
        if payload.scheduled_for is None:
            raise ValidationAppError("scheduled_for is required to schedule a gift order")
        order = await schedule_gift_order(db, order, scheduled_for=payload.scheduled_for)
    elif payload.status == GiftOrderStatus.SENT:
        order = await send_gift_order(db, order)
    elif payload.status == GiftOrderStatus.CANCELLED:
        order = await cancel_gift_order(db, order)
    else:
        raise ValidationAppError(f"Cannot move a gift order to {payload.status.value}")

    return GiftOrderResponse(data=GiftOrderRead.model_validate(order))


@router.get("/stats", response_model=GiftStatsResponse)
async def get_gift_stats(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.view")),
) -> GiftStatsResponse:
    total_gifts_in_catalog = (
        await db.execute(select(func.count()).select_from(GiftCatalogItem))
    ).scalar_one()

    async def _count_orders(order_status: GiftOrderStatus) -> int:
        return (
            await db.execute(
                select(func.count())
                .select_from(GiftOrder)
                .where(GiftOrder.status == order_status.value)
            )
        ).scalar_one()

    return GiftStatsResponse(
        data=GiftStats(
            total_gifts_in_catalog=total_gifts_in_catalog,
            pending_orders_count=await _count_orders(GiftOrderStatus.PENDING),
            scheduled_orders_count=await _count_orders(GiftOrderStatus.SCHEDULED),
            sent_orders_count=await _count_orders(GiftOrderStatus.SENT),
        )
    )
