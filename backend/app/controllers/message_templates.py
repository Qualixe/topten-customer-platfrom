from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db, require_permission
from app.common.exceptions import NotFoundError, ValidationAppError
from app.models.message_template import MessageTemplate, MessageTemplateChannel
from app.views.message_templates import (
    TemplateCreate,
    TemplateRead,
    TemplateResponse,
    TemplatesListResponse,
    TemplatesMeta,
    TemplateUpdate,
)

router = APIRouter()


async def _get_template_or_404(db: AsyncSession, template_id: UUID) -> MessageTemplate:
    template = (
        await db.execute(
            select(MessageTemplate).where(MessageTemplate.public_id == template_id)
        )
    ).scalar_one_or_none()
    if template is None:
        raise NotFoundError("Template not found")
    return template


@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("templates.manage")),
) -> TemplateResponse:
    template = MessageTemplate(
        name=payload.name,
        channel=payload.channel.value,
        category=payload.category.value,
        subject=payload.subject,
        body=payload.body,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return TemplateResponse(data=TemplateRead.model_validate(template))


@router.get("", response_model=TemplatesListResponse)
async def list_templates(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("templates.view")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    channel: MessageTemplateChannel | None = Query(None),
    search: str | None = Query(None, description="Matches template name"),
) -> TemplatesListResponse:
    filters: list[ColumnElement] = []
    if channel is not None:
        filters.append(MessageTemplate.channel == channel.value)

    search = (search or "").strip()
    if search:
        filters.append(MessageTemplate.name.ilike(f"%{search}%"))

    count_query = select(func.count()).select_from(MessageTemplate)
    list_query = select(MessageTemplate)
    for condition in filters:
        count_query = count_query.where(condition)
        list_query = list_query.where(condition)

    total = (await db.execute(count_query)).scalar_one()

    list_query = (
        list_query.order_by(MessageTemplate.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    templates = (await db.execute(list_query)).scalars().all()
    total_pages = max(1, -(-total // page_size))

    return TemplatesListResponse(
        data=[TemplateRead.model_validate(template) for template in templates],
        meta=TemplatesMeta(page=page, page_size=page_size, total=total, total_pages=total_pages),
    )


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("templates.view")),
) -> TemplateResponse:
    template = await _get_template_or_404(db, template_id)
    return TemplateResponse(data=TemplateRead.model_validate(template))


@router.patch("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: UUID,
    payload: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("templates.manage")),
) -> TemplateResponse:
    template = await _get_template_or_404(db, template_id)
    updates = payload.model_dump(exclude_unset=True)

    # An EMAIL template's subject can be edited but never cleared — a
    # blank/omitted-but-explicit-null PATCH would otherwise leave it
    # violating the same "EMAIL requires subject" rule TemplateCreate
    # enforces at creation time.
    if (
        template.channel == MessageTemplateChannel.EMAIL.value
        and "subject" in updates
        and not updates["subject"]
    ):
        raise ValidationAppError("subject cannot be cleared on an EMAIL template")

    for field, value in updates.items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)
    return TemplateResponse(data=TemplateRead.model_validate(template))


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("templates.manage")),
) -> None:
    template = await _get_template_or_404(db, template_id)
    await db.delete(template)
    await db.commit()
