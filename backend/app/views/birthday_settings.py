from pydantic import BaseModel, Field, field_validator


class BirthdaySettingsData(BaseModel):
    notify_days_before: int
    auto_send_message: bool
    message_template: str
    auto_assign_gift: bool


class BirthdaySettingsResponse(BaseModel):
    success: bool = True
    data: BirthdaySettingsData
    meta: dict = {}


class BirthdaySettingsUpdate(BaseModel):
    notify_days_before: int = Field(ge=0, le=30)
    auto_send_message: bool
    message_template: str = Field(min_length=1, max_length=500)
    auto_assign_gift: bool

    @field_validator("message_template")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Message template cannot be blank")
        return stripped


class SendBirthdayWishesReport(BaseModel):
    """Result of one run of the daily auto-wish job — also exposed via a
    manual "send now" endpoint so an admin can trigger/verify it on demand
    without waiting for the scheduled time."""

    total: int
    sent: int
    failed: int
    skipped_already_sent: int


class SendBirthdayWishesResponse(BaseModel):
    success: bool = True
    data: SendBirthdayWishesReport
    meta: dict = {}
