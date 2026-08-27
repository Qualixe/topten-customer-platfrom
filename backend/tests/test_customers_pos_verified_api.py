"""Server-side filtering for the two new customer sub-pages:
GET /customers (used by /dashboard/customers/pos, with the new
profile_status filter) and GET /customers/verified
(/dashboard/customers/verified).
"""

from datetime import UTC, date, datetime

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.campaign_recipient import CampaignRecipient
from app.models.customer import Customer


async def _create_customer(
    db_session: AsyncSession, *, name: str, phone: str, **overrides
) -> Customer:
    overrides.setdefault("customer_type", "GENERAL")
    customer = Customer(name=name, phone=phone, normalized_phone=phone, **overrides)
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def _create_campaign(db_session: AsyncSession, *, name: str) -> Campaign:
    campaign = Campaign(
        name=name,
        campaign_type="PROFILE_COMPLETION",
        audience_rule_type="GENERAL",
        audience_rule_params={},
        message="Hi",
        sender_id="TopTen",
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)
    return campaign


async def _add_verified_recipient(
    db_session: AsyncSession, *, campaign: Campaign, customer: Customer
) -> CampaignRecipient:
    recipient = CampaignRecipient(
        campaign_id=campaign.id,
        customer_id=customer.id,
        phone=customer.phone,
        name=customer.name,
        verification_status="VERIFIED",
        verified_at=datetime.now(UTC),
    )
    db_session.add(recipient)
    await db_session.commit()
    await db_session.refresh(recipient)
    return recipient


async def test_pos_customer_filtering_by_profile_status(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Scenario 12: a customer missing email/address/DOB is INCOMPLETE; one
    with all three filled in is COMPLETE."""
    await _create_customer(db_session, name="Incomplete Guy", phone="+8801711000101")
    await _create_customer(
        db_session,
        name="Complete Guy",
        phone="+8801711000102",
        date_of_birth=date(1990, 1, 1),
        address="1 Road, Dhaka",
        email="complete@example.com",
    )

    complete_response = await client.get(
        "/api/v1/customers", params={"profile_status": "COMPLETE"}
    )
    complete_names = {row["name"] for row in complete_response.json()["data"]}
    assert complete_names == {"Complete Guy"}

    incomplete_response = await client.get(
        "/api/v1/customers", params={"profile_status": "INCOMPLETE"}
    )
    incomplete_names = {row["name"] for row in incomplete_response.json()["data"]}
    assert "Incomplete Guy" in incomplete_names
    assert "Complete Guy" not in incomplete_names


async def test_pos_customer_search_and_customer_type_filter(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _create_customer(db_session, name="Rahim Uddin", phone="+8801711000103")
    await _create_customer(
        db_session, name="VIP Karim", phone="+8801711000104", customer_type="VIP"
    )

    search_response = await client.get("/api/v1/customers", params={"search": "Rahim"})
    assert [row["name"] for row in search_response.json()["data"]] == ["Rahim Uddin"]

    vip_response = await client.get("/api/v1/customers", params={"customer_type": "VIP"})
    assert [row["name"] for row in vip_response.json()["data"]] == ["VIP Karim"]


async def test_verified_customer_filtering_by_campaign(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Scenario 13: filtering /customers/verified by campaign_id only
    returns that campaign's verified recipients."""
    campaign_a = await _create_campaign(db_session, name="Campaign A")
    campaign_b = await _create_campaign(db_session, name="Campaign B")
    customer_1 = await _create_customer(db_session, name="Verified In A", phone="+8801711000105")
    customer_2 = await _create_customer(db_session, name="Verified In B", phone="+8801711000106")
    await _add_verified_recipient(db_session, campaign=campaign_a, customer=customer_1)
    await _add_verified_recipient(db_session, campaign=campaign_b, customer=customer_2)

    response = await client.get(
        "/api/v1/customers/verified", params={"campaign_id": str(campaign_a.public_id)}
    )
    data = response.json()["data"]
    assert [row["name"] for row in data] == ["Verified In A"]
    assert data[0]["campaign_name"] == "Campaign A"


async def test_verified_customer_filtering_by_customer_type_and_search(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    campaign = await _create_campaign(db_session, name="Campaign C")
    general_customer = await _create_customer(
        db_session, name="General Person", phone="+8801711000107"
    )
    vvip_customer = await _create_customer(
        db_session, name="VVIP Person", phone="+8801711000108", customer_type="VVIP"
    )
    await _add_verified_recipient(db_session, campaign=campaign, customer=general_customer)
    await _add_verified_recipient(db_session, campaign=campaign, customer=vvip_customer)

    type_response = await client.get(
        "/api/v1/customers/verified", params={"customer_type": "VVIP"}
    )
    assert [row["name"] for row in type_response.json()["data"]] == ["VVIP Person"]

    search_response = await client.get(
        "/api/v1/customers/verified", params={"search": "General"}
    )
    assert [row["name"] for row in search_response.json()["data"]] == ["General Person"]


async def test_verified_customers_excludes_pending_recipients(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    campaign = await _create_campaign(db_session, name="Campaign D")
    customer = await _create_customer(db_session, name="Not Yet Verified", phone="+8801711000109")
    recipient = CampaignRecipient(
        campaign_id=campaign.id,
        customer_id=customer.id,
        phone=customer.phone,
        name=customer.name,
    )
    db_session.add(recipient)
    await db_session.commit()

    response = await client.get("/api/v1/customers/verified")
    assert response.json()["data"] == []
