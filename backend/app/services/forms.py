"""CRUD for standalone forms, plus converting a form's fields into a
campaign's landing page (see attach_form_to_campaign)."""

import uuid

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign_landing_page import CampaignLandingPage
from app.models.form import Form, FormStatus
from app.services import campaign_landing_pages as landing_page_service
from app.views.campaign_landing_pages import LandingPageBlock, LandingPageBuilderData
from app.views.forms import FormBuilderData, FormFieldSchema

DEFAULT_PAGE_SIZE = 20

# A form field type maps to a landing page block type only if the campaign
# landing page system actually knows how to render + collect it. "text"
# (a generic free-text input) and "phone" have no backing Customer column
# the public profile submission understands (only date_of_birth, address,
# and email are real, storable fields — see PublicProfileUpdate), so
# there's deliberately no entry for them here; attach_form_to_campaign
# reports them as skipped instead of silently dropping them.
_FIELD_TO_BLOCK_TYPE: dict[str, str] = {
    "heading": "heading",
    "paragraph": "text",
    "date_of_birth": "date_of_birth",
    "address": "address",
    "email": "email",
    "divider": "divider",
    "submit_button": "button",
}


async def list_forms(
    db: AsyncSession, *, page: int, page_size: int, search: str | None
) -> tuple[list[Form], int]:
    filters: list[ColumnElement] = []
    search = (search or "").strip()
    if search:
        filters.append(Form.name.ilike(f"%{search}%"))

    count_query = select(func.count()).select_from(Form)
    list_query = select(Form)
    for condition in filters:
        count_query = count_query.where(condition)
        list_query = list_query.where(condition)

    total = (await db.execute(count_query)).scalar_one()

    list_query = (
        list_query.order_by(Form.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    forms = (await db.execute(list_query)).scalars().all()
    return list(forms), total


async def get_form_by_public_id(db: AsyncSession, public_id: uuid.UUID) -> Form | None:
    return (await db.execute(select(Form).where(Form.public_id == public_id))).scalar_one_or_none()


async def create_form(db: AsyncSession, *, name: str, description: str) -> Form:
    form = Form(name=name, description=description, status=FormStatus.DRAFT.value)
    db.add(form)
    await db.commit()
    await db.refresh(form)
    return form


async def update_form(
    db: AsyncSession,
    form: Form,
    *,
    name: str | None,
    description: str | None,
    status: str | None,
    builder_data: FormBuilderData | None,
) -> Form:
    if name is not None:
        form.name = name
    if description is not None:
        form.description = description
    if status is not None:
        form.status = status
    if builder_data is not None:
        form.builder_data = builder_data.model_dump(mode="json")

    await db.commit()
    await db.refresh(form)
    return form


async def delete_form(db: AsyncSession, form: Form) -> None:
    await db.delete(form)
    await db.commit()


async def duplicate_form(db: AsyncSession, form: Form) -> Form:
    fields = list(form.builder_data.get("fields", []))
    copied_fields = [{**field, "id": str(uuid.uuid4())} for field in fields]

    copy = Form(
        name=f"{form.name} Copy",
        description=form.description,
        status=FormStatus.DRAFT.value,
        builder_data={"version": 1, "fields": copied_fields},
    )
    db.add(copy)
    await db.commit()
    await db.refresh(copy)
    return copy


def _slugify(value: str) -> str:
    slug = "".join(char if char.isalnum() else "-" for char in value.lower())
    slug = "-".join(part for part in slug.split("-") if part)
    return slug or "form"


async def _unique_slug(db: AsyncSession, base_slug: str) -> str:
    candidate = base_slug
    suffix = 2
    while True:
        existing = (
            await db.execute(
                select(CampaignLandingPage).where(CampaignLandingPage.slug == candidate)
            )
        ).scalar_one_or_none()
        if existing is None:
            return candidate
        candidate = f"{base_slug}-{suffix}"
        suffix += 1


async def attach_form_to_campaign(
    db: AsyncSession, *, form: Form, campaign_id: int, campaign_slug_seed: str
) -> tuple[CampaignLandingPage, list[str]]:
    """Copies `form`'s fields into `campaign_id`'s landing page (creating it
    if needed, overwriting its blocks if it already exists), reusing the
    existing landing-page/token/verification pipeline unchanged. Returns
    the resulting landing page plus the labels of any fields that had no
    supported landing-page block type and were left out.
    """
    schema_fields = [FormFieldSchema.model_validate(field) for field in form.builder_data["fields"]]

    blocks: list[LandingPageBlock] = []
    skipped_labels: list[str] = []
    for field in schema_fields:
        block_type = _FIELD_TO_BLOCK_TYPE.get(field.type.value)
        if block_type is None:
            skipped_labels.append(field.label or field.type.value)
            continue

        text_content_types = {"heading", "paragraph", "submit_button"}
        content_key = "text" if field.type.value in text_content_types else "label"
        content = {content_key: field.label}
        blocks.append(LandingPageBlock(id=str(uuid.uuid4()), type=block_type, content=content))

    builder_data = LandingPageBuilderData(version=1, blocks=blocks)

    existing = await landing_page_service.get_landing_page_by_campaign_id(db, campaign_id)
    if existing is not None:
        landing_page = await landing_page_service.update_landing_page(
            db, existing, name=form.name, slug=None, builder_data=builder_data, published=None
        )
    else:
        slug = await _unique_slug(db, _slugify(campaign_slug_seed))
        landing_page = await landing_page_service.create_landing_page(
            db,
            campaign_id=campaign_id,
            name=form.name,
            slug=slug,
            builder_data=builder_data,
            published=False,
        )

    return landing_page, skipped_labels
