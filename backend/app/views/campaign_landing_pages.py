"""Validated shape of a campaign landing page's builder JSON.

Blocks are a flat list — no nesting, no free positioning, no columns (see
the builder scope notes in the frontend). `type` is a strict enum so an
unsupported block can never be saved; `content` stays a permissive
string-to-string map (matching the frontend's block state) rather than a
per-type schema, since every block's properties are just a handful of
short text fields — a full per-type schema would be a lot of code for very
little extra safety here.
"""

import re
from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

SLUG_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class LandingPageBlockType(str, Enum):
    heading = "heading"
    text = "text"
    image = "image"
    date_of_birth = "date_of_birth"
    address = "address"
    email = "email"
    button = "button"
    divider = "divider"
    spacer = "spacer"


class LandingPageBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=100)
    type: LandingPageBlockType
    content: dict[str, str] = Field(default_factory=dict)


class LandingPageBuilderData(BaseModel):
    """The whole JSON blob stored in `CampaignLandingPage.builder_data`."""

    model_config = ConfigDict(extra="forbid")

    version: int = 1
    blocks: list[LandingPageBlock] = Field(default_factory=list)


class CampaignLandingPageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=255)
    builder_data: LandingPageBuilderData = Field(default_factory=LandingPageBuilderData)
    published: bool = False

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be blank")
        return stripped

    @field_validator("slug")
    @classmethod
    def _slug_is_url_safe(cls, value: str) -> str:
        stripped = value.strip().lower()
        if not SLUG_PATTERN.match(stripped):
            raise ValueError(
                "Slug must be lowercase letters, numbers, and hyphens only (e.g. summer-sale)"
            )
        return stripped


class CampaignLandingPageUpdate(BaseModel):
    """PATCH body — every field optional, only what's sent is changed."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    builder_data: LandingPageBuilderData | None = None
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
                "Slug must be lowercase letters, numbers, and hyphens only (e.g. summer-sale)"
            )
        return stripped


class CampaignLandingPageRead(BaseModel):
    """Built explicitly in the controller (not via `model_validate`) — the
    ORM row's `campaign_id` is an internal integer FK, not the campaign's
    public UUID, so it always needs to come from the already-loaded
    `Campaign` row instead."""

    id: UUID
    campaign_id: UUID
    name: str
    slug: str
    builder_data: LandingPageBuilderData
    published: bool
    created_at: datetime
    updated_at: datetime


class CampaignLandingPageResponse(BaseModel):
    success: bool = True
    data: CampaignLandingPageRead
    meta: dict = {}


class PublicLandingPageData(BaseModel):
    """What the public /campaign/{slug} page sees — content only, nothing
    that identifies the campaign's internal id or recipients."""

    name: str
    builder_data: LandingPageBuilderData


class PublicLandingPageResponse(BaseModel):
    success: bool = True
    data: PublicLandingPageData
    meta: dict = {}
