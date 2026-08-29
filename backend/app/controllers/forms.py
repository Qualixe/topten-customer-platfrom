from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db, require_permission
from app.common.exceptions import NotFoundError
from app.models.form import Form
from app.services import forms as service
from app.views.forms import (
    FormCreate,
    FormRead,
    FormResponse,
    FormsListResponse,
    FormsMeta,
    FormUpdate,
)

router = APIRouter()


async def _get_form_or_404(db: AsyncSession, form_id: UUID) -> Form:
    form = await service.get_form_by_public_id(db, form_id)
    if form is None:
        raise NotFoundError("Form not found")
    return form


def _form_to_read(form: Form) -> FormRead:
    return FormRead(
        id=form.public_id,
        name=form.name,
        description=form.description,
        status=form.status,
        builder_data=form.builder_data,
        slug=form.slug,
        published=form.published,
        created_at=form.created_at,
        updated_at=form.updated_at,
    )


@router.get("", response_model=FormsListResponse)
async def list_forms(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("forms.view")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, description="Matches the form name"),
) -> FormsListResponse:
    forms, total = await service.list_forms(db, page=page, page_size=page_size, search=search)
    total_pages = max(1, -(-total // page_size))
    return FormsListResponse(
        data=[_form_to_read(form) for form in forms],
        meta=FormsMeta(page=page, page_size=page_size, total=total, total_pages=total_pages),
    )


@router.post("", response_model=FormResponse, status_code=http_status.HTTP_201_CREATED)
async def create_form(
    payload: FormCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("forms.manage")),
) -> FormResponse:
    form = await service.create_form(db, name=payload.name, description=payload.description)
    return FormResponse(data=_form_to_read(form))


@router.get("/{form_id}", response_model=FormResponse)
async def get_form(
    form_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("forms.view")),
) -> FormResponse:
    form = await _get_form_or_404(db, form_id)
    return FormResponse(data=_form_to_read(form))


@router.patch("/{form_id}", response_model=FormResponse)
async def update_form(
    form_id: UUID,
    payload: FormUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("forms.manage")),
) -> FormResponse:
    form = await _get_form_or_404(db, form_id)
    form = await service.update_form(
        db,
        form,
        name=payload.name,
        description=payload.description,
        builder_data=payload.builder_data,
        slug=payload.slug,
        published=payload.published,
    )
    return FormResponse(data=_form_to_read(form))


@router.delete("/{form_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_form(
    form_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("forms.manage")),
) -> None:
    form = await _get_form_or_404(db, form_id)
    await service.delete_form(db, form)


@router.post(
    "/{form_id}/duplicate",
    response_model=FormResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def duplicate_form(
    form_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("forms.manage")),
) -> FormResponse:
    form = await _get_form_or_404(db, form_id)
    copy = await service.duplicate_form(db, form)
    return FormResponse(data=_form_to_read(copy))
