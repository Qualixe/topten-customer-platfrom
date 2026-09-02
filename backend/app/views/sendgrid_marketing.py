from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.common.credentials import PlainFieldStatus, SecretFieldStatus


class SendGridCredentialsStatus(BaseModel):
    """SendGrid Marketing Campaigns — see app.common.sendgrid_client.
    Deliberately minimal: sender/domain verification (SendGrid's own
    mailing-address and nickname requirements for a Sender Identity) is
    treated as an external SendGrid-side setup step, not something this
    app collects or manages — see `sender_verified` below and
    app.services.sendgrid_sync.find_verified_sender."""

    api_key: SecretFieldStatus
    list_name: PlainFieldStatus
    from_name: PlainFieldStatus
    from_email: PlainFieldStatus
    reply_to_email: PlainFieldStatus
    # Live-checked against SendGrid at read time (best-effort — never
    # raises, see app.services.sendgrid_sync.check_sender_verified) so the
    # Settings page can say "verified" for real rather than assuming it.
    sender_verified: bool


class SendGridCredentialsResponse(BaseModel):
    success: bool = True
    data: SendGridCredentialsStatus
    meta: dict = {}


class SendGridCredentialsUpdate(BaseModel):
    """PATCH-style body — omitted fields are left unchanged; a field sent as
    blank/null clears it."""

    api_key: str | None = None
    list_name: str | None = None
    from_name: str | None = None
    from_email: EmailStr | None = None
    reply_to_email: EmailStr | None = None

    @field_validator("api_key", "list_name", "from_name", mode="before")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("from_email", "reply_to_email", mode="before")
    @classmethod
    def _blank_email_to_none(cls, value: str | None) -> str | None:
        # Runs before EmailStr's own format check, so a blank string
        # clears the field (matching the other fields' semantics) instead
        # of being rejected as an invalid email address.
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class SyncRequest(BaseModel):
    customer_ids: list[UUID] = Field(min_length=1)


class SyncItemResult(BaseModel):
    customer_id: UUID
    email: str
    success: bool
    message: str


class SyncReport(BaseModel):
    total: int
    synced: int
    failed: int
    items: list[SyncItemResult]


class SyncResponse(BaseModel):
    success: bool = True
    data: SyncReport
    meta: dict = {}


class CreateCampaignRequest(BaseModel):
    customer_ids: list[UUID] = Field(min_length=1)
    subject: str = Field(min_length=1, max_length=255)
    html_body: str = Field(min_length=1)
    from_name: str | None = None
    from_email: str | None = None


class SendGridCampaignRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID = Field(validation_alias="public_id")
    sendgrid_campaign_id: str
    subject: str
    from_name: str | None
    from_email: str | None
    recipient_count: int
    status: str
    error_message: str | None
    created_at: datetime
    sent_at: datetime | None


class SendGridCampaignResponse(BaseModel):
    success: bool = True
    data: SendGridCampaignRead
    meta: dict = {}


class SendGridCampaignListResponse(BaseModel):
    success: bool = True
    data: list[SendGridCampaignRead]
    meta: dict = {}
