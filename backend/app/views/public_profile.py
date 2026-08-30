from datetime import date

from pydantic import BaseModel, EmailStr, Field, field_validator

MAX_REASONABLE_AGE_YEARS = 120


class PublicProfileCampaign(BaseModel):
    """Present only when the link came from a campaign SMS (a
    campaign-scoped token) — an admin-issued token has no campaign, so this
    stays null. Deliberately just a name and a flag, nothing that could
    identify the campaign or recipient internally."""

    name: str
    already_verified: bool


class PublicProfileData(BaseModel):
    """What an existing customer sees on their own profile-completion link.
    Deliberately excludes id, phone, total_spent, is_vip, and status —
    nothing here lets the frontend infer internal customer data."""

    name: str
    date_of_birth: date | None
    address: str | None
    email: str | None
    campaign: PublicProfileCampaign | None = None


class PublicProfileResponse(BaseModel):
    success: bool = True
    data: PublicProfileData
    meta: dict = {}


class PublicProfileUpdate(BaseModel):
    """Date of birth and address are required (this flow exists specifically
    to collect them); email stays optional. Only these three fields can ever
    be changed via this endpoint — see `update_public_customer_profile`."""

    date_of_birth: date
    address: str = Field(min_length=1, max_length=500)
    email: EmailStr | None = None

    @field_validator("address")
    @classmethod
    def _address_long_enough(cls, value: str) -> str:
        stripped = value.strip()
        # 10 chars matches Pathao's own minimum for a shippable address —
        # confirmed by a real "must be at least 10 characters" rejection
        # from Pathao's live API (see app.services.pathao).
        if len(stripped) < 10:
            raise ValueError("Please enter your full address (at least 10 characters)")
        return stripped

    @field_validator("email", mode="before")
    @classmethod
    def _blank_email_to_none(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("date_of_birth")
    @classmethod
    def _dob_in_reasonable_range(cls, value: date) -> date:
        today = date.today()
        if value > today:
            raise ValueError("Date of birth cannot be in the future")
        earliest = date(today.year - MAX_REASONABLE_AGE_YEARS, today.month, today.day)
        if value < earliest:
            raise ValueError("Date of birth is not a reasonable date")
        return value
