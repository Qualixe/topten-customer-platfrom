import uuid
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db, require_permission
from app.common.exceptions import ValidationAppError
from app.core.config import settings
from app.models.gift_catalog_item import GiftCatalogItem
from app.models.gift_category import GiftCategory
from app.models.gift_order import GiftOrder, GiftOrderStatus
from app.services.gifts import (
    cancel_gift_order,
    create_catalog_item,
    create_category,
    create_gift_order,
    delete_catalog_item,
    delete_category,
    get_catalog_item_or_404,
    get_category_or_404,
    get_gift_order_or_404,
    list_categories,
    schedule_gift_order,
    send_gift_order,
    update_catalog_item,
    update_category,
)
from app.views.gifts import (
    GiftCatalogItemCreate,
    GiftCatalogItemRead,
    GiftCatalogItemResponse,
    GiftCatalogItemUpdate,
    GiftCatalogListResponse,
    GiftCatalogMeta,
    GiftCategoriesListResponse,
    GiftCategoryCreate,
    GiftCategoryRead,
    GiftCategoryResponse,
    GiftCategoryUpdate,
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

# Raster formats only — same reasoning as the site logo upload (an SVG could
# carry an embedded <script>).
ALLOWED_IMAGE_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_GIFT_IMAGE_SIZE_BYTES = 2 * 1024 * 1024


def _gift_image_url(image_path: str | None) -> str | None:
    if not image_path:
        return None
    return f"/gift-images/{Path(image_path).name}"


def _catalog_item_to_read(item: GiftCatalogItem) -> GiftCatalogItemRead:
    return GiftCatalogItemRead(
        id=item.public_id,
        name=item.name,
        category=GiftCategoryRead(id=item.category.public_id, name=item.category.name),
        description=item.description,
        image_url=_gift_image_url(item.image_path),
        points_cost=item.points_cost,
        retail_value=item.retail_value,
        stock_quantity=item.stock_quantity,
        stock_status=item.stock_status,
        times_redeemed=item.times_redeemed,
        created_at=item.created_at,
    )


def _category_to_read(category: GiftCategory) -> GiftCategoryRead:
    return GiftCategoryRead(id=category.public_id, name=category.name)


@router.get("/categories", response_model=GiftCategoriesListResponse)
async def list_categories_endpoint(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.view")),
) -> GiftCategoriesListResponse:
    categories = await list_categories(db)
    return GiftCategoriesListResponse(data=[_category_to_read(category) for category in categories])


@router.post(
    "/categories", response_model=GiftCategoryResponse, status_code=status.HTTP_201_CREATED
)
async def create_category_endpoint(
    payload: GiftCategoryCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.manage")),
) -> GiftCategoryResponse:
    category = await create_category(db, name=payload.name)
    return GiftCategoryResponse(data=_category_to_read(category))


@router.patch("/categories/{category_id}", response_model=GiftCategoryResponse)
async def update_category_endpoint(
    category_id: UUID,
    payload: GiftCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.manage")),
) -> GiftCategoryResponse:
    category = await get_category_or_404(db, category_id)
    category = await update_category(db, category, name=payload.name)
    return GiftCategoryResponse(data=_category_to_read(category))


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category_endpoint(
    category_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.manage")),
) -> None:
    category = await get_category_or_404(db, category_id)
    await delete_category(db, category)


@router.get("/catalog", response_model=GiftCatalogListResponse)
async def list_catalog(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.view")),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = Query(None),
    category_id: UUID | None = Query(None),
) -> GiftCatalogListResponse:
    filters: list[ColumnElement] = []

    search = (search or "").strip()
    if search:
        filters.append(GiftCatalogItem.name.ilike(f"%{search}%"))
    if category_id is not None:
        category = await get_category_or_404(db, category_id)
        filters.append(GiftCatalogItem.category_id == category.id)

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
        data=[_catalog_item_to_read(item) for item in items],
        meta=GiftCatalogMeta(page=page, page_size=page_size, total=total, total_pages=total_pages),
    )


@router.get("/catalog/{item_id}", response_model=GiftCatalogItemResponse)
async def get_catalog_item_endpoint(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.view")),
) -> GiftCatalogItemResponse:
    item = await get_catalog_item_or_404(db, item_id)
    return GiftCatalogItemResponse(data=_catalog_item_to_read(item))


@router.post(
    "/catalog", response_model=GiftCatalogItemResponse, status_code=status.HTTP_201_CREATED
)
async def create_catalog_item_endpoint(
    payload: GiftCatalogItemCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.manage")),
) -> GiftCatalogItemResponse:
    category = await get_category_or_404(db, payload.category_id)
    item = await create_catalog_item(
        db,
        name=payload.name,
        category_id=category.id,
        description=payload.description,
        points_cost=payload.points_cost,
        retail_value=payload.retail_value,
        stock_quantity=payload.stock_quantity,
    )
    return GiftCatalogItemResponse(data=_catalog_item_to_read(item))


@router.patch("/catalog/{item_id}", response_model=GiftCatalogItemResponse)
async def update_catalog_item_endpoint(
    item_id: UUID,
    payload: GiftCatalogItemUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.manage")),
) -> GiftCatalogItemResponse:
    item = await get_catalog_item_or_404(db, item_id)
    category_id = None
    if payload.category_id is not None:
        category = await get_category_or_404(db, payload.category_id)
        category_id = category.id
    item = await update_catalog_item(
        db,
        item,
        name=payload.name,
        category_id=category_id,
        description=payload.description,
        points_cost=payload.points_cost,
        retail_value=payload.retail_value,
        stock_quantity=payload.stock_quantity,
    )
    return GiftCatalogItemResponse(data=_catalog_item_to_read(item))


@router.delete("/catalog/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_catalog_item_endpoint(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.manage")),
) -> None:
    item = await get_catalog_item_or_404(db, item_id)
    await delete_catalog_item(db, item)


@router.put("/catalog/{item_id}/image", response_model=GiftCatalogItemResponse)
async def upload_catalog_item_image(
    item_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.manage")),
) -> GiftCatalogItemResponse:
    item = await get_catalog_item_or_404(db, item_id)

    if file.content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise ValidationAppError("Image must be a PNG, JPEG, or WEBP image")

    contents = await file.read()
    if len(contents) > MAX_GIFT_IMAGE_SIZE_BYTES:
        raise ValidationAppError("Image must be smaller than 2 MB")
    if not contents:
        raise ValidationAppError("Uploaded file is empty")

    upload_dir = Path(settings.GIFT_IMAGE_UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    extension = Path(file.filename or "").suffix or ".png"
    destination = upload_dir / f"{uuid.uuid4()}{extension}"
    destination.write_bytes(contents)

    previous_path = Path(item.image_path) if item.image_path else None

    item.image_path = str(destination)
    await db.commit()
    await db.refresh(item)

    if previous_path and previous_path.exists():
        previous_path.unlink()

    return GiftCatalogItemResponse(data=_catalog_item_to_read(item))


@router.delete("/catalog/{item_id}/image", response_model=GiftCatalogItemResponse)
async def remove_catalog_item_image(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.manage")),
) -> GiftCatalogItemResponse:
    item = await get_catalog_item_or_404(db, item_id)

    if item.image_path:
        old_path = Path(item.image_path)
        item.image_path = None
        await db.commit()
        if old_path.exists():
            old_path.unlink()

    return GiftCatalogItemResponse(data=_catalog_item_to_read(item))


@router.get("/orders", response_model=GiftOrdersListResponse)
async def list_orders(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("gifts.view")),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    order_status: str | None = Query(None, alias="status"),
    catalog_item_id: UUID | None = Query(None),
) -> GiftOrdersListResponse:
    filters: list[ColumnElement] = []
    if order_status and order_status != "all":
        filters.append(GiftOrder.status == order_status)
    if catalog_item_id is not None:
        catalog_item = await get_catalog_item_or_404(db, catalog_item_id)
        filters.append(GiftOrder.catalog_item_id == catalog_item.id)

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
