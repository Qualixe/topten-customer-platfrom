from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.database.models.campaign import AudienceRuleType, CampaignStatus, CampaignType
from app.database.models.campaign_recipient import CampaignRecipientStatus
from app.modules.sms_campaigns.audience import AudienceRule

MAX_MESSAGE_LENGTH = 1600  # ~10 GSM-7 segments — a generous sanity cap

__all__ = [
    "MAX_MESSAGE_LENGTH",
    "AudienceRule",
    "AudienceRuleType",
    "AudienceCounts",
    "AudienceCountsResponse",
    "AudiencePreviewCount",
    "AudiencePreviewResponse",
    "AudiencePreviewRecipient",
    "AudiencePreviewRecipientsMeta",
    "AudiencePreviewRecipientsResponse",
    "CampaignCreate",
    "CampaignUpdate",
    "CampaignRead",
    "CampaignResponse",
    "CampaignsMeta",
    "CampaignsListResponse",
    "CampaignRecipientRead",
    "CampaignRecipientsMeta",
    "CampaignRecipientsListResponse",
    "CampaignStats",
    "CampaignStatsResponse",
]


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    campaign_type: CampaignType
    audience_rule: AudienceRule
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)
    sender_id: str = Field(min_length=1, max_length=20)
    scheduled_at: datetime | None = None
    status: CampaignStatus = CampaignStatus.DRAFT

    @field_validator("name", "sender_id", "message")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("This field cannot be blank")
        return stripped


class CampaignUpdate(BaseModel):
    """PATCH body. `campaign_type` and `audience_rule` are deliberately not
    fields on this model at all — the recipient snapshot is frozen at
    creation and must never change, so the rule that produced it can't
    change either. `extra="forbid"` makes an attempt to PATCH them (or any
    other unknown field) a loud 422 rather than a silently-ignored no-op.
    If `message` changes, `sms_segments` (and `estimated_cost`, once
    recipients are resolved) are recomputed server-side — see the
    endpoint."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=255)
    message: str | None = Field(default=None, min_length=1, max_length=MAX_MESSAGE_LENGTH)
    sender_id: str | None = Field(default=None, min_length=1, max_length=20)
    scheduled_at: datetime | None = None
    status: CampaignStatus | None = None

    @field_validator("name", "sender_id", "message")
    @classmethod
    def _not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("This field cannot be blank")
        return stripped


class CampaignRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(validation_alias="public_id")
    name: str
    campaign_type: CampaignType
    audience_rule_type: AudienceRuleType
    audience_rule_params: dict
    message: str
    sender_id: str
    total_recipients: int
    sms_segments: int
    estimated_cost: Decimal
    scheduled_at: datetime | None
    status: CampaignStatus
    recipients_resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime


class CampaignResponse(BaseModel):
    success: bool = True
    data: CampaignRead
    meta: dict = {}


class CampaignsMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class CampaignsListResponse(BaseModel):
    success: bool = True
    data: list[CampaignRead]
    meta: CampaignsMeta


class AudienceCounts(BaseModel):
    general: int
    vip: int
    vvip: int
    missing_dob: int
    missing_address: int
    missing_dob_and_address: int


class AudienceCountsResponse(BaseModel):
    success: bool = True
    data: AudienceCounts
    meta: dict = {}


class AudiencePreviewCount(BaseModel):
    count: int


class AudiencePreviewResponse(BaseModel):
    success: bool = True
    data: AudiencePreviewCount
    meta: dict = {}


class AudiencePreviewRecipient(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(validation_alias="public_id")
    name: str
    phone: str


class AudiencePreviewRecipientsMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class AudiencePreviewRecipientsResponse(BaseModel):
    success: bool = True
    data: list[AudiencePreviewRecipient]
    meta: AudiencePreviewRecipientsMeta


class CampaignRecipientRead(BaseModel):
    """Built directly from a (CampaignRecipient, customer_public_id) pair in
    service.py rather than via model_validate(orm_instance) — customer_id
    needs the *customer's* public_id, which isn't an attribute of
    CampaignRecipient itself. `populate_by_name=True` lets the constructor
    accept `id=` (the field's own name) alongside its `public_id` alias."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID = Field(validation_alias="public_id")
    customer_id: UUID
    phone: str
    status: CampaignRecipientStatus
    provider_message_id: str | None
    sent_at: datetime | None
    delivered_at: datetime | None
    failed_at: datetime | None
    failure_reason: str | None
    created_at: datetime
    updated_at: datetime


class CampaignRecipientsMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class CampaignRecipientsListResponse(BaseModel):
    success: bool = True
    data: list[CampaignRecipientRead]
    meta: CampaignRecipientsMeta


class CampaignStats(BaseModel):
    total: int
    pending: int
    sent: int
    delivered: int
    failed: int


class CampaignStatsResponse(BaseModel):
    success: bool = True
    data: CampaignStats
    meta: dict = {}
