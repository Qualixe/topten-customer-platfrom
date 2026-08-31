"""CRUD for standalone forms, plus:
- converting a form's fields into a campaign's landing page (see
  attach_form_to_campaign) — a tokenized link for one known customer;
- accepting a tokenless public submission (see submit_generic_form) —
  creates/finds a Customer by phone instead.
"""

import uuid

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import ValidationAppError
from app.common.phone import InvalidPhoneNumberError, normalize_phone
from app.models.campaign_landing_page import CampaignLandingPage
from app.models.customer import Customer
from app.models.form import Form
from app.services import campaign_landing_pages as landing_page_service
from app.views.campaign_landing_pages import LandingPageBlock, LandingPageBuilderData
from app.views.forms import FormBuilderData, FormFieldSchema, GenericFormSubmission

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


def _default_builder_data() -> dict:
    """A sensible starting point instead of a blank canvas. Name + Phone are
    included because they're required for this form to also work as an
    open, tokenless public form (see submit_generic_form) — if the form is
    instead attached to a campaign, they're simply skipped there (reported
    via skipped_field_labels), since a token-based submission already knows
    who the customer is. date_of_birth/address are marked required since a
    real submission actually requires them there too (see
    PublicProfileUpdate) — this session's earlier work flagged missing them
    as a real pitfall. Each field gets its own fresh id so multiple new
    forms never collide."""
    return {
        "version": 1,
        "fields": [
            {
                "id": str(uuid.uuid4()),
                "type": "heading",
                "label": "Complete Your Profile",
                "align": "left",
                "size": "md",
            },
            {
                "id": str(uuid.uuid4()),
                "type": "name",
                "label": "Full Name",
                "required": True,
            },
            {
                "id": str(uuid.uuid4()),
                "type": "phone",
                "label": "Phone Number",
                "placeholder": "+8801XXXXXXXXX",
                "required": True,
            },
            {
                "id": str(uuid.uuid4()),
                "type": "date_of_birth",
                "label": "Date of Birth",
                "required": True,
            },
            {
                "id": str(uuid.uuid4()),
                "type": "address",
                "label": "Address",
                "placeholder": "Street, city, postcode",
                "required": True,
            },
            {
                "id": str(uuid.uuid4()),
                "type": "email",
                "label": "Email Address",
                "placeholder": "you@example.com",
                "required": False,
            },
            {"id": str(uuid.uuid4()), "type": "submit_button", "label": "Save my details"},
        ],
    }


async def create_form(db: AsyncSession, *, name: str, description: str) -> Form:
    form = Form(name=name, description=description, builder_data=_default_builder_data())
    db.add(form)
    await db.commit()
    await db.refresh(form)
    return form


async def _ensure_form_slug_available(
    db: AsyncSession, slug: str, *, exclude_id: int | None = None
) -> None:
    query = select(Form).where(Form.slug == slug)
    if exclude_id is not None:
        query = query.where(Form.id != exclude_id)
    existing = (await db.execute(query)).scalar_one_or_none()
    if existing is not None:
        raise ValidationAppError(f'The slug "{slug}" is already in use by another form')


async def update_form(
    db: AsyncSession,
    form: Form,
    *,
    name: str | None,
    description: str | None,
    builder_data: FormBuilderData | None,
    slug: str | None,
    published: bool | None,
) -> Form:
    if name is not None:
        form.name = name
    if description is not None:
        form.description = description
    if builder_data is not None:
        form.builder_data = builder_data.model_dump(mode="json")
    if slug is not None and slug != form.slug:
        await _ensure_form_slug_available(db, slug, exclude_id=form.id)
        form.slug = slug
    if published is not None:
        if published and not form.slug:
            raise ValidationAppError("Set a slug before publishing this form")
        form.published = published

    await db.commit()
    await db.refresh(form)
    return form


async def get_published_form_by_slug(db: AsyncSession, slug: str) -> Form | None:
    """Only a published form is ever returned — a draft must never be
    reachable on the public site, same rule as campaign landing pages."""
    return (
        await db.execute(select(Form).where(Form.slug == slug, Form.published.is_(True)))
    ).scalar_one_or_none()


def _required_field_types(form: Form) -> set[str]:
    """Which of email/date_of_birth/address this specific form's own
    config marks required — name/phone are always required regardless (see
    GenericFormSubmission), since a Customer can't exist without them."""
    return {
        field["type"]
        for field in form.builder_data.get("fields", [])
        if field.get("type") in {"email", "date_of_birth", "address"} and field.get("required")
    }


async def submit_generic_form(
    db: AsyncSession, *, form: Form, submission: GenericFormSubmission
) -> Customer:
    """Tokenless public submission — finds or creates a Customer by phone
    (matching the same identity rule POS imports use), rather than updating
    one already identified by a token. Existing date_of_birth/address/email
    are only overwritten with a new, non-blank value — the same "never
    blank out real data" rule imports and the token-based profile form both
    already follow (see Customer's docstring)."""
    required = _required_field_types(form)
    missing = [
        label
        for field_type, label in (
            ("email", "Email"),
            ("date_of_birth", "Date of birth"),
            ("address", "Address"),
        )
        if field_type in required and not getattr(submission, field_type)
    ]
    if missing:
        verb = "is" if len(missing) == 1 else "are"
        raise ValidationAppError(f"{', '.join(missing)} {verb} required")

    # 10 chars matches Pathao's own minimum for a shippable address (see
    # app.services.pathao) — checked whenever an address is given, not just
    # when the form marks it required.
    if submission.address and len(submission.address.strip()) < 10:
        raise ValidationAppError("Please enter your full address (at least 10 characters)")

    try:
        normalized = normalize_phone(submission.phone)
    except InvalidPhoneNumberError as exc:
        raise ValidationAppError(str(exc)) from exc

    customer = (
        await db.execute(select(Customer).where(Customer.normalized_phone == normalized))
    ).scalar_one_or_none()

    if customer is None:
        customer = Customer(
            name=submission.name, phone=submission.phone, normalized_phone=normalized
        )
        db.add(customer)
    # An existing customer's name/phone are never overwritten here — this is
    # a public, tokenless endpoint identified only by phone digits, so
    # accepting arbitrary name changes for a matched record would let
    # anyone silently rename a real customer they don't otherwise control.

    if submission.email:
        customer.email = submission.email
    if submission.date_of_birth:
        customer.date_of_birth = submission.date_of_birth
    if submission.address:
        customer.address = submission.address

    await db.commit()
    await db.refresh(customer)
    return customer


async def delete_form(db: AsyncSession, form: Form) -> None:
    await db.delete(form)
    await db.commit()


async def duplicate_form(db: AsyncSession, form: Form) -> Form:
    fields = list(form.builder_data.get("fields", []))
    copied_fields = [{**field, "id": str(uuid.uuid4())} for field in fields]

    # Deliberately doesn't copy slug/published — a duplicate must never
    # come out already live at the original form's public URL.
    copy = Form(
        name=f"{form.name} Copy",
        description=form.description,
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
        # Heading and paragraph are the only form field types with extra
        # display properties right now — carry them over so e.g. a centered
        # heading/paragraph in the form builder stays centered on the
        # campaign landing page instead of silently reverting to the
        # block's left-aligned default.
        if field.type.value in {"heading", "paragraph"} and field.align is not None:
            content["align"] = field.align.value
        if field.type.value == "heading" and field.size is not None:
            content["size"] = field.size.value
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
