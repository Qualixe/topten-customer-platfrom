from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.message_template import MessageTemplateCategory, MessageTemplateChannel

MAX_NAME_LENGTH = 255
MAX_SUBJECT_LENGTH = 255


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=MAX_NAME_LENGTH)
    channel: MessageTemplateChannel
    category: MessageTemplateCategory = MessageTemplateCategory.GENERAL
    # Required for EMAIL, ignored for SMS — see _subject_matches_channel.
    subject: str | None = Field(default=None, max_length=MAX_SUBJECT_LENGTH)
    body: str = Field(min_length=1)

    @field_validator("name", "subject", "body")
    @classmethod
    def _not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("This field cannot be blank")
        return stripped

    @model_validator(mode="after")
    def _subject_matches_channel(self) -> "TemplateCreate":
        if self.channel == MessageTemplateChannel.EMAIL and not self.subject:
            raise ValueError("subject is required for an EMAIL template")
        if self.channel == MessageTemplateChannel.SMS:
            self.subject = None
        return self


class TemplateUpdate(BaseModel):
    """PATCH body. `channel` is deliberately not a field here — changing it
    after the fact would leave a stale subject (EMAIL→SMS) or a missing one
    (SMS→EMAIL); create a new template instead."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=MAX_NAME_LENGTH)
    category: MessageTemplateCategory | None = None
    subject: str | None = Field(default=None, max_length=MAX_SUBJECT_LENGTH)
    body: str | None = Field(default=None, min_length=1)

    @field_validator("name", "subject", "body")
    @classmethod
    def _not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("This field cannot be blank")
        return stripped


class TemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(validation_alias="public_id")
    name: str
    channel: MessageTemplateChannel
    category: MessageTemplateCategory
    subject: str | None
    body: str
    created_at: datetime
    updated_at: datetime


class TemplateResponse(BaseModel):
    success: bool = True
    data: TemplateRead
    meta: dict = {}


class TemplatesMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class TemplatesListResponse(BaseModel):
    success: bool = True
    data: list[TemplateRead]
    meta: TemplatesMeta
