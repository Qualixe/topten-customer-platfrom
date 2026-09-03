"""Covers the Campaign -> Landing Page -> Customer -> Verification flow:
a customer submitting a campaign-scoped public profile link marks that one
CampaignRecipient VERIFIED, without ever creating a second Customer row,
and without confusing SMS delivery with form verification.

Scenario numbers below match the checklist in the feature request.
"""

from datetime import UTC, datetime

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.campaign_recipient import (
    CampaignRecipient,
    CampaignRecipientStatus,
    VerificationStatus,
)
from app.models.customer import Customer
from app.models.customer_profile_token import CustomerProfileToken
from tests.support import get_customer_type_id


async def _create_customer(db_session: AsyncSession, *, name: str, phone: str) -> Customer:
    customer = Customer(
        name=name,
        phone=phone,
        normalized_phone=phone,
        customer_type_id=await get_customer_type_id(db_session),
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def _create_campaign(db_session: AsyncSession, *, name: str = "Campaign A") -> Campaign:
    campaign = Campaign(
        name=name,
        campaign_type="PROFILE_COMPLETION",
        audience_rule_type="GENERAL",
        audience_rule_params={},
        message="Hi {{customer_name}}, please complete your profile: {{form_link}}",
        sender_id="TopTen",
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)
    return campaign


async def _add_recipient(
    db_session: AsyncSession, *, campaign: Campaign, customer: Customer
) -> CampaignRecipient:
    recipient = CampaignRecipient(
        campaign_id=campaign.id,
        customer_id=customer.id,
        phone=customer.phone,
        name=customer.name,
    )
    db_session.add(recipient)
    await db_session.commit()
    await db_session.refresh(recipient)
    return recipient


async def _issue_campaign_token(
    db_session: AsyncSession, *, customer: Customer, campaign: Campaign
) -> str:
    token = CustomerProfileToken(customer_id=customer.id, campaign_id=campaign.id)
    db_session.add(token)
    await db_session.commit()
    await db_session.refresh(token)
    return token.token


SUBMIT_PAYLOAD = {
    "date_of_birth": "1995-05-20",
    "address": "12 Gulshan Ave, Dhaka",
    "email": "rahim@example.com",
}


async def test_pos_customer_without_verification(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Scenario 1: a plain POS-style customer, never targeted by any
    campaign, must not show up as verified."""
    await _create_customer(db_session, name="Rahim Uddin", phone="+8801711000001")

    response = await client.get("/api/v1/customers/verified")
    assert response.json()["data"] == []


async def test_campaign_recipient_starts_pending_verification(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Scenario 2."""
    customer = await _create_customer(db_session, name="Karim", phone="+8801711000002")
    campaign = await _create_campaign(db_session)
    recipient = await _add_recipient(db_session, campaign=campaign, customer=customer)

    assert recipient.verification_status == VerificationStatus.PENDING.value
    assert recipient.verified_at is None


async def test_submitting_campaign_form_marks_recipient_verified(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Scenarios 3, 4, 5: submitting the form for Campaign 1 verifies that
    one recipient and stores verified_at."""
    customer = await _create_customer(db_session, name="Rahim", phone="+8801711000003")
    campaign = await _create_campaign(db_session, name="Campaign 1")
    recipient = await _add_recipient(db_session, campaign=campaign, customer=customer)
    token = await _issue_campaign_token(db_session, customer=customer, campaign=campaign)

    before = datetime.now(UTC)
    response = await unauthenticated_client.patch(
        f"/api/v1/public/customer-profile/{token}", json=SUBMIT_PAYLOAD
    )
    assert response.status_code == 200
    assert response.json()["data"]["campaign"] == {"name": "Campaign 1", "already_verified": True}

    await db_session.refresh(recipient)
    assert recipient.verification_status == VerificationStatus.VERIFIED.value
    assert recipient.verified_at is not None
    assert recipient.verified_at >= before


async def test_one_customer_verified_for_two_campaigns_stays_one_customer_row(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Scenarios 6, 7, 8: Rahim completes Campaign 1 and Campaign 2 — he
    must still exist exactly once in `customers`, verified for both."""
    customer = await _create_customer(db_session, name="Rahim", phone="+8801711000004")
    campaign_1 = await _create_campaign(db_session, name="Campaign 1")
    campaign_2 = await _create_campaign(db_session, name="Campaign 2")
    await _add_recipient(db_session, campaign=campaign_1, customer=customer)
    await _add_recipient(db_session, campaign=campaign_2, customer=customer)

    token_1 = await _issue_campaign_token(db_session, customer=customer, campaign=campaign_1)
    token_2 = await _issue_campaign_token(db_session, customer=customer, campaign=campaign_2)

    resp_1 = await unauthenticated_client.patch(
        f"/api/v1/public/customer-profile/{token_1}", json=SUBMIT_PAYLOAD
    )
    resp_2 = await unauthenticated_client.patch(
        f"/api/v1/public/customer-profile/{token_2}", json=SUBMIT_PAYLOAD
    )
    assert resp_1.status_code == 200
    assert resp_2.status_code == 200

    customer_count = (
        await db_session.execute(
            select(func.count()).select_from(Customer).where(Customer.phone == "+8801711000004")
        )
    ).scalar_one()
    assert customer_count == 1

    verified_campaign_names = (
        await db_session.execute(
            select(Campaign.name)
            .join(CampaignRecipient, CampaignRecipient.campaign_id == Campaign.id)
            .where(
                CampaignRecipient.customer_id == customer.id,
                CampaignRecipient.verification_status == VerificationStatus.VERIFIED.value,
            )
        )
    ).scalars().all()
    assert set(verified_campaign_names) == {"Campaign 1", "Campaign 2"}


async def test_resubmitting_the_same_campaign_form_does_not_duplicate_or_move_verified_at(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Scenario 9: duplicate verification is prevented — the unique
    (campaign_id, customer_id) constraint on campaign_recipients means
    there can only ever be one row, and resubmitting must not shift
    verified_at to a later time."""
    customer = await _create_customer(db_session, name="Karim", phone="+8801711000005")
    campaign = await _create_campaign(db_session)
    recipient = await _add_recipient(db_session, campaign=campaign, customer=customer)
    token = await _issue_campaign_token(db_session, customer=customer, campaign=campaign)

    await unauthenticated_client.patch(
        f"/api/v1/public/customer-profile/{token}", json=SUBMIT_PAYLOAD
    )
    await db_session.refresh(recipient)
    first_verified_at = recipient.verified_at

    await unauthenticated_client.patch(
        f"/api/v1/public/customer-profile/{token}", json=SUBMIT_PAYLOAD
    )
    await db_session.refresh(recipient)

    assert recipient.verified_at == first_verified_at

    recipient_count = (
        await db_session.execute(
            select(func.count())
            .select_from(CampaignRecipient)
            .where(
                CampaignRecipient.campaign_id == campaign.id,
                CampaignRecipient.customer_id == customer.id,
            )
        )
    ).scalar_one()
    assert recipient_count == 1


async def test_sms_delivered_does_not_mean_verified(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Scenario 10: marking a recipient's SMS as DELIVERED must never
    change verification_status — the two are unrelated fields."""
    customer = await _create_customer(db_session, name="Nasrin", phone="+8801711000006")
    campaign = await _create_campaign(db_session)
    recipient = await _add_recipient(db_session, campaign=campaign, customer=customer)

    recipient.status = CampaignRecipientStatus.DELIVERED.value
    recipient.delivered_at = datetime.now(UTC)
    await db_session.commit()
    await db_session.refresh(recipient)

    assert recipient.status == CampaignRecipientStatus.DELIVERED.value
    assert recipient.verification_status == VerificationStatus.PENDING.value
    assert recipient.verified_at is None


async def test_campaign_verification_statistics_are_correct(
    client: AsyncClient, unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Scenario 11: 4 recipients, 3 verified -> 75.0% verification rate,
    computed server-side by GET /sms/campaigns/{id}/stats."""
    campaign = await _create_campaign(db_session)
    customers = [
        await _create_customer(db_session, name=f"Customer {i}", phone=f"+880171100001{i}")
        for i in range(4)
    ]
    for customer in customers:
        await _add_recipient(db_session, campaign=campaign, customer=customer)

    for customer in customers[:3]:
        token = await _issue_campaign_token(db_session, customer=customer, campaign=campaign)
        await unauthenticated_client.patch(
            f"/api/v1/public/customer-profile/{token}", json=SUBMIT_PAYLOAD
        )

    response = await client.get(f"/api/v1/sms/campaigns/{campaign.public_id}/stats")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 4
    assert data["verified"] == 3
    assert data["pending_verification"] == 1
    assert data["verification_rate"] == 75.0


async def test_customer_cannot_access_another_customers_campaign_form(
    unauthenticated_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Scenario 20: each token identifies exactly one customer — there is
    no way to reach customer B's data through customer A's token, and each
    customer's own link only ever returns their own data."""
    campaign = await _create_campaign(db_session)
    customer_a = await _create_customer(db_session, name="Customer A", phone="+8801711000020")
    customer_b = await _create_customer(db_session, name="Customer B", phone="+8801711000021")
    await _add_recipient(db_session, campaign=campaign, customer=customer_a)
    await _add_recipient(db_session, campaign=campaign, customer=customer_b)

    token_a = await _issue_campaign_token(db_session, customer=customer_a, campaign=campaign)
    token_b = await _issue_campaign_token(db_session, customer=customer_b, campaign=campaign)

    response_a = await unauthenticated_client.get(f"/api/v1/public/customer-profile/{token_a}")
    response_b = await unauthenticated_client.get(f"/api/v1/public/customer-profile/{token_b}")

    assert response_a.json()["data"]["name"] == "Customer A"
    assert response_b.json()["data"]["name"] == "Customer B"

    # A made-up token (not customer B's real one) must 404 like any other
    # invalid token — never silently fall back to some other customer.
    bogus_response = await unauthenticated_client.get(
        "/api/v1/public/customer-profile/not-a-real-token-at-all"
    )
    assert bogus_response.status_code == 404
