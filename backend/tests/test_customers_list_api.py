"""GET /api/v1/customers — pagination, search, and status/VIP filtering."""

from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.campaign_recipient import CampaignRecipient
from app.models.customer import Customer


async def _add_customer(
    db_session: AsyncSession,
    *,
    name: str,
    phone: str,
    status: str = "active",
    is_vip: bool = False,
    total_spent: str = "0",
    customer_type: str | None = None,
) -> Customer:
    customer = Customer(
        name=name,
        phone=phone,
        normalized_phone=phone,
        status=status,
        is_vip=is_vip,
        total_spent=Decimal(total_spent),
        **({"customer_type": customer_type} if customer_type else {}),
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def test_empty_list_has_success_envelope_and_zero_total(client: AsyncClient) -> None:
    response = await client.get("/api/v1/customers")
    assert response.status_code == 200

    body = response.json()
    assert body["success"] is True
    assert body["data"] == []
    assert body["meta"] == {"page": 1, "page_size": 20, "total": 0, "total_pages": 1}


async def test_list_returns_public_id_not_internal_id(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session, name="Rahim Uddin", phone="+8801711000101")

    response = await client.get("/api/v1/customers")
    body = response.json()

    assert body["meta"]["total"] == 1
    assert body["data"][0]["id"] == str(customer.public_id)


async def test_pagination_returns_bounded_page(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    for i in range(5):
        await _add_customer(db_session, name=f"Customer {i}", phone=f"+88017110001{i:02d}")

    response = await client.get("/api/v1/customers", params={"page": 2, "page_size": 2})
    body = response.json()

    assert body["meta"] == {"page": 2, "page_size": 2, "total": 5, "total_pages": 3}
    assert len(body["data"]) == 2


async def test_search_matches_name_or_phone(client: AsyncClient, db_session: AsyncSession) -> None:
    await _add_customer(db_session, name="Rahim Uddin", phone="+8801711000101")
    await _add_customer(db_session, name="Karim Hossain", phone="+8801711000102")

    response = await client.get("/api/v1/customers", params={"search": "rahim"})
    body = response.json()

    assert body["meta"]["total"] == 1
    assert body["data"][0]["name"] == "Rahim Uddin"


async def test_status_filter(client: AsyncClient, db_session: AsyncSession) -> None:
    await _add_customer(db_session, name="Active One", phone="+8801711000101", status="active")
    await _add_customer(
        db_session, name="Suspended One", phone="+8801711000102", status="suspended"
    )

    response = await client.get("/api/v1/customers", params={"status": "suspended"})
    body = response.json()

    assert body["meta"]["total"] == 1
    assert body["data"][0]["name"] == "Suspended One"


async def test_is_vip_filter(client: AsyncClient, db_session: AsyncSession) -> None:
    await _add_customer(db_session, name="VIP One", phone="+8801711000101", is_vip=True)
    await _add_customer(db_session, name="Regular One", phone="+8801711000102", is_vip=False)

    response = await client.get("/api/v1/customers", params={"is_vip": "true"})
    body = response.json()

    assert body["meta"]["total"] == 1
    assert body["data"][0]["name"] == "VIP One"


async def test_verified_filter(client: AsyncClient, db_session: AsyncSession) -> None:
    verified = await _add_customer(db_session, name="Verified One", phone="+8801711000101")
    unverified = await _add_customer(db_session, name="Unverified One", phone="+8801711000102")

    campaign = Campaign(
        name="Profile Completion",
        campaign_type="PROFILE_COMPLETION",
        audience_rule_type="GENERAL",
        audience_rule_params={},
        message="Hi",
        sender_id="TopTen",
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    db_session.add_all(
        [
            CampaignRecipient(
                campaign_id=campaign.id,
                customer_id=verified.id,
                phone=verified.phone,
                name=verified.name,
                verification_status="VERIFIED",
            ),
            CampaignRecipient(
                campaign_id=campaign.id,
                customer_id=unverified.id,
                phone=unverified.phone,
                name=unverified.name,
                verification_status="PENDING",
            ),
        ]
    )
    await db_session.commit()

    response = await client.get("/api/v1/customers", params={"verified": "true"})
    body = response.json()

    assert body["meta"]["total"] == 1
    assert body["data"][0]["name"] == "Verified One"

    # Omitting the filter still returns everyone, verified or not.
    all_response = await client.get("/api/v1/customers")
    assert all_response.json()["meta"]["total"] == 2


# Scenario 9: customer list filtering by customer_type.


async def test_customer_type_defaults_to_general(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _add_customer(db_session, name="Rahim Uddin", phone="+8801711000101")

    response = await client.get("/api/v1/customers")
    assert response.json()["data"][0]["customer_type"] == "GENERAL"


async def test_customer_type_filter(client: AsyncClient, db_session: AsyncSession) -> None:
    await _add_customer(
        db_session, name="General One", phone="+8801711000101", customer_type="GENERAL"
    )
    await _add_customer(db_session, name="VIP One", phone="+8801711000102", customer_type="VIP")
    await _add_customer(
        db_session, name="VVIP One", phone="+8801711000103", customer_type="VVIP"
    )

    response = await client.get("/api/v1/customers", params={"customer_type": "VIP"})
    body = response.json()

    assert body["meta"]["total"] == 1
    assert body["data"][0]["name"] == "VIP One"


async def test_customer_type_filter_all_returns_everyone(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _add_customer(
        db_session, name="General One", phone="+8801711000101", customer_type="GENERAL"
    )
    await _add_customer(db_session, name="VIP One", phone="+8801711000102", customer_type="VIP")

    response = await client.get("/api/v1/customers", params={"customer_type": "all"})
    assert response.json()["meta"]["total"] == 2


# Scenario 10: invalid customer type is rejected.


async def test_invalid_customer_type_filter_is_rejected(client: AsyncClient) -> None:
    response = await client.get("/api/v1/customers", params={"customer_type": "PLATINUM"})
    assert response.status_code == 422
