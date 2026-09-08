from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator


class BirthdayChannel(StrEnum):
    SMS = "SMS"
    EMAIL = "EMAIL"
    BOTH = "BOTH"


class BirthdaySettingsData(BaseModel):
    notify_days_before: int
    enabled: bool
    channel: BirthdayChannel
    send_hour: int
    send_minute: int
    company_name: str
    message_template: str
    email_subject: str
    email_message_template: str
    auto_assign_gift: bool
    last_run_at: datetime | None


class BirthdaySettingsResponse(BaseModel):
    success: bool = True
    data: BirthdaySettingsData
    meta: dict = {}


class BirthdaySettingsUpdate(BaseModel):
    notify_days_before: int = Field(ge=0, le=30)
    enabled: bool
    channel: BirthdayChannel
    send_hour: int = Field(ge=0, le=23)
    send_minute: int = Field(ge=0, le=59)
    company_name: str = Field(max_length=120)
    message_template: str = Field(min_length=1, max_length=500)
    email_subject: str = Field(min_length=1, max_length=255)
    email_message_template: str = Field(min_length=1, max_length=2000)
    auto_assign_gift: bool

    @field_validator("message_template", "email_subject", "email_message_template")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("This field cannot be blank")
        return stripped

    @field_validator("company_name")
    @classmethod
    def _strip_company_name(cls, value: str) -> str:
        return value.strip()
