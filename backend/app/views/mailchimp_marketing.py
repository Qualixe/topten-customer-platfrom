from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.common.credentials import PlainFieldStatus, SecretFieldStatus


class MailchimpCredentialsStatus(BaseModel):
    """Mailchimp Marketing (Audience sync + campaign send) — see
    app.common.mailchimp_client. Deliberately minimal: this app never
    creates an Audience via the API (Mailchimp requires
    company/address/permission-reminder fields this app doesn't collect)
    — the admin creates one in Mailchimp and pastes its id here.
    `list_valid`/`list_name` are live-checked at read time (best effort —
    never raises, see app.services.mailchimp_sync.check_list_status) so
    Settings can confirm the id actually resolves rather than assuming it.
    `from_name`/`reply_to_email` are only needed to send a campaign, not
    to sync — the from-email address itself comes from the Audience's own
    Campaign Defaults, set in Mailchimp directly."""

    api_key: SecretFieldStatus
    list_id: PlainFieldStatus
    list_valid: bool
    list_name: str | None
    from_name: PlainFieldStatus
    reply_to_email: PlainFieldStatus


class MailchimpCredentialsResponse(BaseModel):
    success: bool = True
    data: MailchimpCredentialsStatus
    meta: dict = {}


class MailchimpCredentialsUpdate(BaseModel):
    """PATCH-style body — omitted fields are left unchanged; a field sent as
    blank/null clears it."""

    api_key: str | None = None
    list_id: str | None = None
    from_name: str | None = None
    reply_to_email: str | None = None

    @field_validator("api_key", "list_id", "from_name", "reply_to_email")
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


class SendCampaignRequest(BaseModel):
    customer_ids: list[UUID] = Field(min_length=1)
    subject: str = Field(min_length=1, max_length=255)
    html_body: str = Field(min_length=1)


class SendCampaignReport(BaseModel):
    total: int
    sent: int
    failed: int
    items: list[SyncItemResult]
    # None if sending failed before Mailchimp assigned a campaign at all
    # (e.g. no eligible recipients) — otherwise a link to view it in
    # Mailchimp's own dashboard.
    campaign_url: str | None = None


class SendCampaignResponse(BaseModel):
    success: bool = True
    data: SendCampaignReport
    meta: dict = {}


class SendTestCampaignRequest(BaseModel):
    test_emails: list[str] = Field(min_length=1)
    subject: str = Field(min_length=1, max_length=255)
    html_body: str = Field(min_length=1)
