"""Audience rule schema + SQL condition builder.

Every rule resolves to a single SQLAlchemy boolean expression evaluated
against `Customer` — never a Python-side loop over loaded rows. The two
"campaign history" rules (NEVER_RECEIVED_TYPE / RECEIVED_TYPE_BEFORE_DATE)
resolve to a correlated EXISTS/NOT EXISTS subquery against
`CampaignRecipient` joined to `Campaign`, which Postgres can execute as an
index-backed anti/semi-join rather than materializing anything — see the
indexes on `campaign_recipients.customer_id` and `campaigns.campaign_type`.
"""

from datetime import UTC, date, datetime, time
from uuid import UUID

from pydantic import BaseModel, model_validator
from sqlalchemy import ColumnElement, and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import AudienceRuleType, Campaign, CampaignType
from app.models.campaign_recipient import CampaignRecipient, VerificationStatus
from app.models.customer import Customer, CustomerType


class AudienceRule(BaseModel):
    """The client-facing shape of an audience rule. Only the fields relevant
    to `rule_type` are required/used — see `_validate_params_for_rule_type`.
    `since_campaign_id` is a convenience input only (e.g. "new customers
    since Campaign A"): it's resolved to a concrete `since_date` before
    storage, so a campaign's stored rule is always self-contained and never
    depends on another campaign continuing to exist."""

    rule_type: AudienceRuleType
    since_date: date | None = None
    since_campaign_id: UUID | None = None
    campaign_type: CampaignType | None = None
    before_date: date | None = None
    customer_ids: list[UUID] | None = None

    @model_validator(mode="after")
    def _validate_params_for_rule_type(self) -> "AudienceRule":
        if self.rule_type == AudienceRuleType.NEW_SINCE_DATE:
            has_date = self.since_date is not None
            has_campaign = self.since_campaign_id is not None
            if has_date == has_campaign:
                raise ValueError(
                    "NEW_SINCE_DATE requires exactly one of since_date or since_campaign_id"
                )
        elif self.rule_type == AudienceRuleType.NEVER_RECEIVED_TYPE:
            if self.campaign_type is None:
                raise ValueError("NEVER_RECEIVED_TYPE requires campaign_type")
        elif self.rule_type == AudienceRuleType.RECEIVED_TYPE_BEFORE_DATE:
            if self.campaign_type is None or self.before_date is None:
                raise ValueError(
                    "RECEIVED_TYPE_BEFORE_DATE requires campaign_type and before_date"
                )
        elif self.rule_type == AudienceRuleType.SPECIFIC_CUSTOMERS:
            if not self.customer_ids:
                raise ValueError("SPECIFIC_CUSTOMERS requires a non-empty customer_ids")
        return self

    def storage_params(self) -> dict:
        """Only the params relevant to `rule_type`, JSON-serializable, for
        persisting on `Campaign.audience_rule_params`. Never includes
        `since_campaign_id` — that's resolved away before this is called."""
        if self.rule_type == AudienceRuleType.NEW_SINCE_DATE:
            return {"since_date": self.since_date.isoformat()}
        if self.rule_type == AudienceRuleType.NEVER_RECEIVED_TYPE:
            return {"campaign_type": self.campaign_type.value}
        if self.rule_type == AudienceRuleType.RECEIVED_TYPE_BEFORE_DATE:
            return {
                "campaign_type": self.campaign_type.value,
                "before_date": self.before_date.isoformat(),
            }
        if self.rule_type == AudienceRuleType.SPECIFIC_CUSTOMERS:
            assert self.customer_ids is not None
            return {"customer_ids": [str(customer_id) for customer_id in self.customer_ids]}
        return {}

    @classmethod
    def from_stored(cls, rule_type: str, params: dict) -> "AudienceRule":
        return cls(rule_type=AudienceRuleType(rule_type), **params)


async def resolve_since_campaign(db: AsyncSession, rule: AudienceRule) -> AudienceRule:
    """If `rule` references `since_campaign_id`, looks that campaign up and
    returns an equivalent rule with a concrete `since_date` instead. Called
    once, before storage/condition-building — the stored rule never carries
    a live reference to another campaign."""
    if rule.since_campaign_id is None:
        return rule

    referenced = (
        await db.execute(select(Campaign).where(Campaign.public_id == rule.since_campaign_id))
    ).scalar_one_or_none()
    if referenced is None:
        raise ValueError(f"since_campaign_id {rule.since_campaign_id} does not exist")

    return rule.model_copy(
        update={"since_date": referenced.created_at.date(), "since_campaign_id": None}
    )


def _midnight_utc(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=UTC)


def build_condition(rule: AudienceRule) -> ColumnElement[bool]:
    """`rule.since_campaign_id` must already be resolved (see
    `resolve_since_campaign`) before calling this."""
    if rule.rule_type == AudienceRuleType.GENERAL:
        return Customer.customer_type == CustomerType.GENERAL.value
    if rule.rule_type == AudienceRuleType.VIP:
        return Customer.customer_type == CustomerType.VIP.value
    if rule.rule_type == AudienceRuleType.VVIP:
        return Customer.customer_type == CustomerType.VVIP.value
    if rule.rule_type == AudienceRuleType.MISSING_DOB:
        return Customer.date_of_birth.is_(None)
    if rule.rule_type == AudienceRuleType.MISSING_ADDRESS:
        return Customer.address.is_(None)
    if rule.rule_type == AudienceRuleType.MISSING_DOB_AND_ADDRESS:
        return and_(Customer.date_of_birth.is_(None), Customer.address.is_(None))
    if rule.rule_type == AudienceRuleType.SPECIFIC_CUSTOMERS:
        assert rule.customer_ids is not None
        return Customer.public_id.in_(rule.customer_ids)

    if rule.rule_type == AudienceRuleType.NEW_SINCE_DATE:
        assert rule.since_date is not None
        return Customer.created_at >= _midnight_utc(rule.since_date)

    if rule.rule_type == AudienceRuleType.NEVER_RECEIVED_TYPE:
        assert rule.campaign_type is not None
        exists_subquery = (
            select(CampaignRecipient.id)
            .join(Campaign, Campaign.id == CampaignRecipient.campaign_id)
            .where(
                CampaignRecipient.customer_id == Customer.id,
                Campaign.campaign_type == rule.campaign_type.value,
            )
        )
        return ~exists_subquery.exists()

    if rule.rule_type == AudienceRuleType.RECEIVED_TYPE_BEFORE_DATE:
        assert rule.campaign_type is not None and rule.before_date is not None
        exists_subquery = (
            select(CampaignRecipient.id)
            .join(Campaign, Campaign.id == CampaignRecipient.campaign_id)
            .where(
                CampaignRecipient.customer_id == Customer.id,
                Campaign.campaign_type == rule.campaign_type.value,
                CampaignRecipient.created_at < _midnight_utc(rule.before_date),
            )
        )
        return exists_subquery.exists()

    if rule.rule_type == AudienceRuleType.NEVER_VERIFIED:
        verified_subquery = select(CampaignRecipient.id).where(
            CampaignRecipient.customer_id == Customer.id,
            CampaignRecipient.verification_status == VerificationStatus.VERIFIED.value,
        )
        return ~verified_subquery.exists()

    if rule.rule_type == AudienceRuleType.TARGETED_NOT_VERIFIED:
        targeted_subquery = select(CampaignRecipient.id).where(
            CampaignRecipient.customer_id == Customer.id
        )
        verified_subquery = select(CampaignRecipient.id).where(
            CampaignRecipient.customer_id == Customer.id,
            CampaignRecipient.verification_status == VerificationStatus.VERIFIED.value,
        )
        return and_(targeted_subquery.exists(), ~verified_subquery.exists())

    raise ValueError(f"Unknown audience rule type: {rule.rule_type!r}")
