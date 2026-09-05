from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.common.credentials import PlainFieldStatus, SecretFieldStatus


class MailchimpCredentialsStatus(BaseModel):
    """Mailchimp Marketing (Audience sync) — see app.common.mailchimp_client.
    Deliberately minimal: this app never creates an Audience via the API
    (Mailchimp requires company/address/permission-reminder fields this app
    doesn't collect) — the admin creates one in Mailchimp and pastes its id
    here. `list_valid`/`list_name` are live-checked at read time (best
    effort — never raises, see app.services.mailchimp_sync.check_list_status)
    so Settings can confirm the id actually resolves rather than assuming it."""

    api_key: SecretFieldStatus
    list_id: PlainFieldStatus
    list_valid: bool
    list_name: str | None


class MailchimpCredentialsResponse(BaseModel):
    success: bool = True
    data: MailchimpCredentialsStatus
    meta: dict = {}


class MailchimpCredentialsUpdate(BaseModel):
    """PATCH-style body — omitted fields are left unchanged; a field sent as
    blank/null clears it."""

    api_key: str | None = None
    list_id: str | None = None

    @field_validator("api_key", "list_id")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
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
