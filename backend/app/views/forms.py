"""Validated shape of a standalone form's builder JSON.

Mirrors app.views.campaign_landing_pages: fields are a flat list (no
nesting), `type` is a strict enum, and each field's properties stay a
permissive dict-like set of optional attributes rather than a per-type
schema — cheap to validate, still rejects unsupported field types.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class FormFieldType(str, Enum):
    heading = "heading"
    paragraph = "paragraph"
    text = "text"
    email = "email"
    phone = "phone"
    date_of_birth = "date_of_birth"
    address = "address"
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
    status: FormStatusValue | None = None
    builder_data: FormBuilderData | None = None

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be blank")
        return stripped


class FormRead(BaseModel):
    id: UUID
    name: str
    description: str
    status: FormStatusValue
    builder_data: FormBuilderData
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
