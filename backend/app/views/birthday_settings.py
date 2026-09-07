from pydantic import BaseModel, Field, field_validator


class BirthdaySettingsData(BaseModel):
    notify_days_before: int
    auto_send_message: bool
    message_template: str
    auto_send_email: bool
    email_subject: str
    email_message_template: str
    auto_assign_gift: bool


class BirthdaySettingsResponse(BaseModel):
    success: bool = True
    data: BirthdaySettingsData
    meta: dict = {}


class BirthdaySettingsUpdate(BaseModel):
    notify_days_before: int = Field(ge=0, le=30)
    auto_send_message: bool
    message_template: str = Field(min_length=1, max_length=500)
    auto_send_email: bool
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
