"""Audience rule resolution — every rule is a single SQL condition
(`app.services.sms_campaigns_audience.build_condition`), never a Python-side
loop over loaded customer rows. Covers every rule type in isolation; the
"large dataset" / "snapshot freeze" scenarios live in
test_campaign_recipient_snapshot.py since those need the actual resolution
task, not just the condition builder.
"""

from datetime import UTC, date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.campaign_recipient import CampaignRecipient
from app.models.customer import Customer
from app.services.sms_campaigns import count_audience
from app.services.sms_campaigns_audience import AudienceRule, resolve_since_campaign


async def _add_customer(
    db_session: AsyncSession,
    *,
    name: str,
    phone: str,
    customer_type: str = "GENERAL",
    date_of_birth: date | None = None,
    address: str | None = None,
    created_at: datetime | None = None,
) -> Customer:
    customer = Customer(
        name=name,
        phone=phone,
        normalized_phone=phone,
        customer_type=customer_type,
        date_of_birth=date_of_birth,
        address=address,
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)

    if created_at is not None:
        update_stmt = (
            Customer.__table__.update()
            .where(Customer.id == customer.id)
            .values(created_at=created_at)
        )
        await db_session.execute(update_stmt)
        await db_session.commit()
        await db_session.refresh(customer)

    return customer


async def _add_campaign(
    db_session: AsyncSession, *, campaign_type: str = "PROMOTIONAL"
) -> Campaign:
    campaign = Campaign(
        name="Seed campaign",
        campaign_type=campaign_type,
        audience_rule_type="GENERAL",
        audience_rule_params={},
        message="hi",
        sender_id="TopTen",
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)
    return campaign


async def _add_recipient(
    db_session: AsyncSession,
    *,
    campaign: Campaign,
    customer: Customer,
    created_at: datetime | None = None,
) -> CampaignRecipient:
    recipient = CampaignRecipient(
        campaign_id=campaign.id, customer_id=customer.id, phone=customer.phone
    )
    db_session.add(recipient)
    await db_session.commit()
    await db_session.refresh(recipient)

    if created_at is not None:
        await db_session.execute(
            CampaignRecipient.__table__.update()
            .where(CampaignRecipient.id == recipient.id)
            .values(created_at=created_at)
        )
        await db_session.commit()

    return recipient


async def test_general_vip_vvip(db_session: AsyncSession) -> None:
    await _add_customer(db_session, name="A", phone="+8801711000101", customer_type="GENERAL")
    await _add_customer(db_session, name="B", phone="+8801711000102", customer_type="VIP")
    await _add_customer(db_session, name="C", phone="+8801711000103", customer_type="VVIP")
    await _add_customer(db_session, name="D", phone="+8801711000104", customer_type="VIP")

    assert await count_audience(db_session, AudienceRule(rule_type="GENERAL")) == 1
    assert await count_audience(db_session, AudienceRule(rule_type="VIP")) == 2
    assert await count_audience(db_session, AudienceRule(rule_type="VVIP")) == 1


async def test_missing_dob(db_session: AsyncSession) -> None:
    await _add_customer(db_session, name="A", phone="+8801711000101", date_of_birth=None)
    await _add_customer(
        db_session, name="B", phone="+8801711000102", date_of_birth=date(1990, 1, 1)
    )

    assert await count_audience(db_session, AudienceRule(rule_type="MISSING_DOB")) == 1


async def test_missing_address(db_session: AsyncSession) -> None:
    await _add_customer(db_session, name="A", phone="+8801711000101", address=None)
    await _add_customer(db_session, name="B", phone="+8801711000102", address="Dhaka")

    assert await count_audience(db_session, AudienceRule(rule_type="MISSING_ADDRESS")) == 1


async def test_missing_dob_and_address_requires_both(db_session: AsyncSession) -> None:
    await _add_customer(
        db_session, name="MissingBoth", phone="+8801711000101", date_of_birth=None, address=None
    )
    await _add_customer(
        db_session,
        name="MissingOnlyDob",
        phone="+8801711000102",
        date_of_birth=None,
        address="Dhaka",
    )
    await _add_customer(
        db_session,
        name="MissingNeither",
        phone="+8801711000103",
        date_of_birth=date(1990, 1, 1),
        address="Dhaka",
    )

    count = await count_audience(db_session, AudienceRule(rule_type="MISSING_DOB_AND_ADDRESS"))
    assert count == 1


async def test_new_since_date_excludes_older_customers(db_session: AsyncSession) -> None:
    """Scenario 3 from the task: an existing customer created before the
    cutoff date must not be counted as "new"."""
    old_created_at = datetime(2026, 8, 19, 9, tzinfo=UTC)
    new_created_at = datetime(2026, 8, 20, 9, tzinfo=UTC)
    await _add_customer(
        db_session, name="Old", phone="+8801711000101", created_at=old_created_at
    )
    await _add_customer(
        db_session, name="New", phone="+8801711000102", created_at=new_created_at
    )

    rule = AudienceRule(rule_type="NEW_SINCE_DATE", since_date=date(2026, 8, 20))
    assert await count_audience(db_session, rule) == 1


async def test_new_since_campaign_resolves_to_that_campaigns_date(db_session: AsyncSession) -> None:
    """"New customers since Campaign A" — a convenience input that resolves
    to a concrete since_date before the rule is used/stored."""
    campaign_a = await _add_campaign(db_session)
    await db_session.execute(
        Campaign.__table__.update()
        .where(Campaign.id == campaign_a.id)
        .values(created_at=datetime(2026, 8, 19, 12, tzinfo=UTC))
    )
    await db_session.commit()
    await db_session.refresh(campaign_a)

    rule = AudienceRule(rule_type="NEW_SINCE_DATE", since_campaign_id=campaign_a.public_id)
    resolved = await resolve_since_campaign(db_session, rule)

    assert resolved.since_campaign_id is None
    assert resolved.since_date == date(2026, 8, 19)


async def test_never_received_campaign_type(db_session: AsyncSession) -> None:
    campaign = await _add_campaign(db_session, campaign_type="PROFILE_COMPLETION")
    received = await _add_customer(db_session, name="Received", phone="+8801711000101")
    never_received = await _add_customer(db_session, name="Never", phone="+8801711000102")
    await _add_recipient(db_session, campaign=campaign, customer=received)

    rule = AudienceRule(rule_type="NEVER_RECEIVED_TYPE", campaign_type="PROFILE_COMPLETION")
    assert await count_audience(db_session, rule) == 1

    # It shouldn't matter what type a *different* campaign was — only
    # PROFILE_COMPLETION history disqualifies someone from this rule.
    other_campaign = await _add_campaign(db_session, campaign_type="PROMOTIONAL")
    await _add_recipient(db_session, campaign=other_campaign, customer=never_received)
    assert await count_audience(db_session, rule) == 1


async def test_received_type_before_date(db_session: AsyncSession) -> None:
    campaign = await _add_campaign(db_session, campaign_type="PROFILE_COMPLETION")
    customer = await _add_customer(db_session, name="A", phone="+8801711000101")
    received_at = datetime(2026, 8, 1, tzinfo=UTC)
    await _add_recipient(db_session, campaign=campaign, customer=customer, created_at=received_at)

    rule_after_cutoff = AudienceRule(
        rule_type="RECEIVED_TYPE_BEFORE_DATE",
        campaign_type="PROFILE_COMPLETION",
        before_date=date(2026, 8, 19),
    )
    assert await count_audience(db_session, rule_after_cutoff) == 1

    rule_before_receipt = AudienceRule(
        rule_type="RECEIVED_TYPE_BEFORE_DATE",
        campaign_type="PROFILE_COMPLETION",
        before_date=date(2026, 7, 1),
    )
    assert await count_audience(db_session, rule_before_receipt) == 0


async def test_specific_customers(db_session: AsyncSession) -> None:
    picked = await _add_customer(db_session, name="Picked", phone="+8801711000101")
    await _add_customer(db_session, name="NotPicked", phone="+8801711000102")

    rule = AudienceRule(rule_type="SPECIFIC_CUSTOMERS", customer_ids=[picked.public_id])
    assert await count_audience(db_session, rule) == 1

    # storage_params/from_stored round-trip, exactly as a real create+resolve
    # would exercise it (see app.tasks.sms_campaigns).
    stored = AudienceRule.from_stored("SPECIFIC_CUSTOMERS", rule.storage_params())
    assert await count_audience(db_session, stored) == 1
