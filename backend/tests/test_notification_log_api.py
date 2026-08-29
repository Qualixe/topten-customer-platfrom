"""GET /api/v1/notifications and /notifications/stats — the read-only log
that fans in real CampaignRecipient sends and real (SENT) GiftOrder sends.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import merge_credential_data
from app.common.sms_gateway_client import SendSmsResult
from app.models.campaign import Campaign
from app.models.campaign_recipient import CampaignRecipient
from app.models.customer import Customer
from app.models.gift_catalog_item import GiftCatalogItem
from app.models.gift_category import GiftCategory
from app.models.gift_order import GiftOrder
from app.services.sms_campaigns import SMS_GATEWAY_PROVIDER


async def _add_customer(
    db_session: AsyncSession, *, name: str = "Rahim Uddin", phone: str = "+8801711000101"
) -> Customer:
    customer = Customer(name=name, phone=phone, normalized_phone=phone, customer_type="GENERAL")
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def _add_campaign(
    db_session: AsyncSession, *, name: str = "Eid Promo", campaign_type: str = "PROMOTIONAL"
) -> Campaign:
    campaign = Campaign(
        name=name,
        campaign_type=campaign_type,
        audience_rule_type="GENERAL",
        audience_rule_params={},
        message="Hi {{customer_name}}, enjoy our Eid offers!",
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
    status: str = "SENT",
) -> CampaignRecipient:
    recipient = CampaignRecipient(
        campaign_id=campaign.id,
        customer_id=customer.id,
        phone=customer.phone,
        name=customer.name,
        status=status,
        sent_at=datetime.now(UTC) if status in ("SENT", "DELIVERED") else None,
        failed_at=datetime.now(UTC) if status == "FAILED" else None,
        failure_reason="Carrier rejected message" if status == "FAILED" else None,
    )
    db_session.add(recipient)
    await db_session.commit()
    await db_session.refresh(recipient)
    return recipient


async def _add_catalog_item(db_session: AsyncSession) -> GiftCatalogItem:
    category = GiftCategory(name="Notif Test Category")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    item = GiftCatalogItem(
        name="Free Mug",
        category_id=category.id,
        description="A mug",
        retail_value="200.00",
        stock_quantity=10,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


async def _send_gift_order(
    client: AsyncClient, db_session: AsyncSession, *, customer: Customer, success: bool
) -> str:
    await merge_credential_data(
        db_session,
        SMS_GATEWAY_PROVIDER,
        {"api_url": "https://example.com/api/smsapi", "api_key": "key", "sender_id": "TOPTEN"},
    )
    item = await _add_catalog_item(db_session)
    order = GiftOrder(
        customer_id=customer.id,
        catalog_item_id=item.id,
        gift_name=item.name,
        occasion="BIRTHDAY",
    )
    db_session.add(order)
    await db_session.commit()
    await db_session.refresh(order)

    mock_result = SendSmsResult(
        success=success, http_status=200 if success else 500, message="OK" if success else "Down"
    )
    with patch("app.services.gifts.gateway_send_sms", new=AsyncMock(return_value=mock_result)):
        response = await client.patch(
            f"/api/v1/gifts/orders/{order.public_id}", json={"status": "SENT"}
        )
    assert response.status_code == 200
    return item.name


async def test_list_notifications_includes_campaign_and_gift_sends(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session, name="Farhana Akter")
    campaign = await _add_campaign(db_session, name="Eid Promo", campaign_type="PROMOTIONAL")
    await _add_recipient(db_session, campaign=campaign, customer=customer, status="SENT")

    gift_customer = await _add_customer(db_session, name="Rakib Hossain", phone="+8801711000199")
    gift_name = await _send_gift_order(client, db_session, customer=gift_customer, success=True)

    response = await client.get("/api/v1/notifications")
    assert response.status_code == 200
    body = response.json()
    subjects = {record["subject"] for record in body["data"]}
    types = {record["type"] for record in body["data"]}
    assert "Eid Promo" in subjects
    assert "Your gift is on the way" in subjects
    assert "Campaign" in types
    assert "Gift Notification" in types

    gift_record = next(r for r in body["data"] if r["type"] == "Gift Notification")
    assert gift_record["status"] == "Sent"
    assert gift_record["recipient_name"] == "Rakib Hossain"
    assert gift_name in gift_record["message"]

    campaign_record = next(r for r in body["data"] if r["type"] == "Campaign")
    assert campaign_record["status"] == "Sent"
    assert "Farhana Akter" in campaign_record["message"]


async def test_gift_order_send_failure_shows_as_failed_notification(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session, name="Nadia Islam")
    await _send_gift_order(client, db_session, customer=customer, success=False)

    response = await client.get("/api/v1/notifications", params={"type": "Gift Notification"})
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) == 1
    assert data[0]["status"] == "Failed"
    assert data[0]["failure_reason"] is not None


async def test_pending_gift_order_is_not_a_notification_yet(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session, name="Kamrul Haque")
    item = await _add_catalog_item(db_session)
    order = GiftOrder(
        customer_id=customer.id,
        catalog_item_id=item.id,
        gift_name=item.name,
        occasion="BIRTHDAY",
    )
    db_session.add(order)
    await db_session.commit()

    response = await client.get("/api/v1/notifications", params={"type": "Gift Notification"})
    assert response.status_code == 200
    assert response.json()["data"] == []


async def test_birthday_and_vip_campaign_types_map_to_expected_notification_type(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session, name="Ayesha Sultana")
    birthday_campaign = await _add_campaign(
        db_session, name="Happy Birthday", campaign_type="BIRTHDAY"
    )
    vip_campaign = await _add_campaign(db_session, name="VIP Treat", campaign_type="VIP")
    await _add_recipient(db_session, campaign=birthday_campaign, customer=customer, status="SENT")
    await _add_recipient(db_session, campaign=vip_campaign, customer=customer, status="SENT")

    response = await client.get("/api/v1/notifications")
    assert response.status_code == 200
    by_subject = {record["subject"]: record["type"] for record in response.json()["data"]}
    assert by_subject["Happy Birthday"] == "Birthday Wish"
    assert by_subject["VIP Treat"] == "VIP Reward"


async def test_list_notifications_filters_by_status(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session, name="Tanvir Ahmed")
    campaign = await _add_campaign(db_session)
    await _add_recipient(db_session, campaign=campaign, customer=customer, status="FAILED")

    response = await client.get("/api/v1/notifications", params={"status": "Failed"})
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) == 1
    assert data[0]["status"] == "Failed"
    assert data[0]["failure_reason"] == "Carrier rejected message"

    response = await client.get("/api/v1/notifications", params={"status": "Delivered"})
    assert response.json()["data"] == []


async def test_notification_stats_reflect_real_sends(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    customer = await _add_customer(db_session, name="Israt Jahan")
    campaign = await _add_campaign(db_session)
    await _add_recipient(db_session, campaign=campaign, customer=customer, status="SENT")
    await _add_recipient(
        db_session,
        campaign=campaign,
        customer=await _add_customer(db_session, name="Shafin Karim", phone="+8801711000201"),
        status="FAILED",
    )

    response = await client.get("/api/v1/notifications/stats")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 2
    assert data["failed"] == 1
    # No delivery-receipt webhook exists anywhere in this codebase, so
    # "Delivered" never actually happens — this is the honest current state.
    assert data["delivered"] == 0
