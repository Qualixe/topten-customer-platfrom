"""Validated shape of a standalone form's builder JSON.

Mirrors app.views.campaign_landing_pages: fields are a flat list (no
nesting), `type` is a strict enum, and each field's properties stay a
permissive dict-like set of optional attributes rather than a per-type
schema — cheap to validate, still rejects unsupported field types.
"""

import re
from datetime import date, datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

SLUG_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

# A published form lives at the site root (mysite.com/{slug}), not under a
# /form/ prefix — so it must never collide with an existing top-level
# frontend route, or that route would win and the form would silently
# become unreachable despite the backend thinking it's published.
RESERVED_SLUGS = {"login", "dashboard", "campaign", "customer", "form", "api", "favicon.ico"}


class FormFieldType(str, Enum):
    heading = "heading"
    paragraph = "paragraph"
    name = "name"
    text = "text"
    email = "email"
    phone = "phone"
    date_of_birth = "date_of_birth"
    address = "address"
    city = "city"
    divider = "divider"
    submit_button = "submit_button"


class FormFieldAlign(str, Enum):
    left = "left"
    center = "center"
    right = "right"


class FormFieldSize(str, Enum):
    sm = "sm"
    md = "md"
    lg = "lg"


class FormFieldSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=100)
    type: FormFieldType
    label: str = Field(default="", max_length=255)
    placeholder: str | None = Field(default=None, max_length=255)
    required: bool | None = None
    align: FormFieldAlign | None = None
    size: FormFieldSize | None = None


class FormBuilderData(BaseModel):
    """The whole JSON blob stored in `Form.builder_data`."""

    model_config = ConfigDict(extra="forbid")

    version: int = 1
    fields: list[FormFieldSchema] = Field(default_factory=list)


class FormStatusValue(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"


class FormCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=1000)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be blank")
        return stripped


class FormUpdate(BaseModel):
    """PATCH body — every field optional, only what's sent is changed."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    builder_data: FormBuilderData | None = None
    # Publishing this form as an open, tokenless public form at the site
    # root — mysite.com/{slug} — independent of attaching it to a campaign
    # (see attach_form_to_campaign). `status` (DRAFT/PUBLISHED, on FormRead)
    # is derived entirely from `published` — see Form.status — so it isn't
    # a field here; there's nothing to set it to independently.
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    published: bool | None = None

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be blank")
        return stripped

    @field_validator("slug")
    @classmethod
    def _slug_is_url_safe(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip().lower()
        if not SLUG_PATTERN.match(stripped):
            raise ValueError(
                "Slug must be lowercase letters, numbers, and hyphens only (e.g. summer-signup)"
            )
        if stripped in RESERVED_SLUGS:
            raise ValueError(
                f'"{stripped}" is a reserved page — choose a different slug'
            )
        return stripped


class FormRead(BaseModel):
    id: UUID
    name: str
    description: str
    status: FormStatusValue
    builder_data: FormBuilderData
    slug: str | None
    published: bool
    created_at: datetime
    updated_at: datetime


class FormResponse(BaseModel):
    success: bool = True
    data: FormRead
    meta: dict = {}


class FormsMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class FormsListResponse(BaseModel):
    success: bool = True
    data: list[FormRead]
    meta: FormsMeta


class PublicFormData(BaseModel):
    """Content only — no internal id, status, or anything else — for the
    public, tokenless /form/{slug} page."""

    name: str
    builder_data: FormBuilderData


class PublicFormResponse(BaseModel):
    success: bool = True
    data: PublicFormData
    meta: dict = {}


class GenericFormSubmission(BaseModel):
    """A tokenless public form submission. Unlike the existing
    PublicProfileUpdate (which updates one already-known customer
    identified by a token), this creates or finds a Customer by phone — so
    name and phone are always required here regardless of whether the
    admin's form marked them required; a Customer record can't exist
    without them. Which of email/date_of_birth/address/city are actually
    mandatory depends on that specific form's own field config — enforced
    in app.services.forms.submit_generic_form, not here, since it varies
    per form."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=1, max_length=32)
    email: str | None = None
    date_of_birth: date | None = None
    address: str | None = None
    city: str | None = None

    @field_validator("name", "phone")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("This field cannot be blank")
        return stripped


class GenericFormSubmissionResponse(BaseModel):
    success: bool = True
    data: dict = {}
    meta: dict = {}
