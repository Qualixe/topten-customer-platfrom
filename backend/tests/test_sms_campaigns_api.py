"""API contract tests for the campaign endpoints.

`resolve_campaign_audience.delay` is patched out — these tests check the
HTTP contract (status codes, response shape, persistence) rather than
re-running audience resolution, which is already covered directly against
the test database in test_campaign_recipient_snapshot.py. Tests that need an
actual resolved snapshot (recipients/stats endpoints) call
`resolve_campaign_audience_async` directly instead of going through Celery.
"""


import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.campaign_recipient import CampaignRecipient
from app.models.customer import Customer
from app.tasks.sms_campaigns import resolve_campaign_audience_async
from tests.conftest import TestSessionLocal
from tests.support import get_customer_type_id


@pytest.fixture(autouse=True)
def _patch_celery_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.controllers.sms_campaigns.resolve_campaign_audience.delay",
        lambda campaign_id: None,
    )


def _create_payload(**overrides) -> dict:
    payload = {
        "name": "Eid Promo",
        "campaign_type": "PROMOTIONAL",
        "audience_rule": {"rule_type": "GENERAL"},
        "message": "Hello there!",
        "sender_id": "TopTen",
    }
    payload.update(overrides)
    return payload


async def _add_customer(db_session: AsyncSession, *, name: str, phone: str) -> Customer:
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


async def test_create_campaign_computes_segments_and_defers_recipients(
    client: AsyncClient,
) -> None:
    response = await client.post("/api/v1/sms/campaigns", json=_create_payload())
    assert response.status_code == 201

    data = response.json()["data"]
    assert data["name"] == "Eid Promo"
    assert data["campaign_type"] == "PROMOTIONAL"
    assert data["audience_rule_type"] == "GENERAL"
    assert data["sms_segments"] == 1
    # Recipients are resolved in the background — not trustworthy yet.
    assert data["total_recipients"] == 0
    assert data["recipients_resolved_at"] is None
    assert data["status"] == "DRAFT"


async def test_create_campaign_with_form_id_attaches_published_landing_page(
    client: AsyncClient,
) -> None:
    """A form_id on creation must produce a landing page that's already
    published by the time the response comes back — resolution/sending is
    queued right after, so it can't be attached later without racing it."""
    form_response = await client.post("/api/v1/forms", json={"name": "Quick Profile"})
    form_id = form_response.json()["data"]["id"]
    await client.patch(
        f"/api/v1/forms/{form_id}",
        json={
            "builder_data": {
                "version": 1,
                "fields": [
                    {"id": "f1", "type": "date_of_birth", "label": "Date of Birth"},
                    {"id": "f2", "type": "address", "label": "Address"},
                ],
            }
        },
    )

    response = await client.post(
        "/api/v1/sms/campaigns", json=_create_payload(form_id=form_id)
    )
    assert response.status_code == 201
    campaign_id = response.json()["data"]["id"]

    landing_page_response = await client.get(
        f"/api/v1/sms/campaigns/{campaign_id}/landing-page"
    )
    assert landing_page_response.status_code == 200
    landing_page = landing_page_response.json()["data"]
    assert landing_page["published"] is True
    assert len(landing_page["builder_data"]["blocks"]) == 2


async def test_create_campaign_with_form_id_reports_skipped_fields(
    client: AsyncClient,
) -> None:
    """A form field type the landing page builder doesn't support (e.g.
    `phone` — there's no Customer column a public submission could write it
    to) is silently dropped from the landing page. Creation must report
    that back via `meta.skipped_field_labels`, same as the standalone
    POST /{id}/landing-page/from-form/{form_id} endpoint does — otherwise
    an admin has no way to know their form doesn't match what actually
    sends."""
    form_response = await client.post("/api/v1/forms", json={"name": "DOB Capture Form"})
    form_id = form_response.json()["data"]["id"]
    await client.patch(
        f"/api/v1/forms/{form_id}",
        json={
            "builder_data": {
                "version": 1,
                "fields": [
                    {"id": "f1", "type": "email", "label": "Email Address"},
                    {"id": "f2", "type": "phone", "label": "Phone Number"},
                    {"id": "f3", "type": "date_of_birth", "label": "Date of Birth"},
                    {"id": "f4", "type": "address", "label": "Address"},
                ],
            }
        },
    )

    response = await client.post(
        "/api/v1/sms/campaigns", json=_create_payload(form_id=form_id)
    )
    assert response.status_code == 201
    body = response.json()
    assert body["meta"]["skipped_field_labels"] == ["Phone Number"]

    landing_page_response = await client.get(
        f"/api/v1/sms/campaigns/{body['data']['id']}/landing-page"
    )
    block_types = {
        block["type"] for block in landing_page_response.json()["data"]["builder_data"]["blocks"]
    }
    assert "phone" not in block_types


async def test_create_campaign_rejects_new_since_date_without_a_date(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/sms/campaigns",
        json=_create_payload(audience_rule={"rule_type": "NEW_SINCE_DATE"}),
    )
    assert response.status_code == 422


async def test_create_campaign_rejects_never_received_type_without_campaign_type(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/v1/sms/campaigns",
        json=_create_payload(audience_rule={"rule_type": "NEVER_RECEIVED_TYPE"}),
    )
    assert response.status_code == 422


async def test_create_campaign_rejects_blank_message(client: AsyncClient) -> None:
    response = await client.post("/api/v1/sms/campaigns", json=_create_payload(message="   "))
    assert response.status_code == 422


async def test_get_campaign_by_id(client: AsyncClient) -> None:
    created = (await client.post("/api/v1/sms/campaigns", json=_create_payload())).json()["data"]
    response = await client.get(f"/api/v1/sms/campaigns/{created['id']}")
    assert response.status_code == 200
    assert response.json()["data"]["id"] == created["id"]


async def test_get_unknown_campaign_404(client: AsyncClient) -> None:
    response = await client.get("/api/v1/sms/campaigns/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


async def test_list_campaigns_paginated_and_filtered(client: AsyncClient) -> None:
    await client.post("/api/v1/sms/campaigns", json=_create_payload(name="Alpha", status="DRAFT"))
    await client.post(
        "/api/v1/sms/campaigns",
        json=_create_payload(name="Beta", campaign_type="BIRTHDAY", status="SCHEDULED"),
    )

    response = await client.get("/api/v1/sms/campaigns", params={"status": "SCHEDULED"})
    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["total"] == 1
    assert body["data"][0]["name"] == "Beta"

    response = await client.get("/api/v1/sms/campaigns", params={"campaign_type": "BIRTHDAY"})
    assert response.json()["meta"]["total"] == 1

    response = await client.get("/api/v1/sms/campaigns", params={"search": "alpha"})
    assert response.json()["data"][0]["name"] == "Alpha"


async def test_patch_updates_allowed_fields(client: AsyncClient) -> None:
    created = (await client.post("/api/v1/sms/campaigns", json=_create_payload())).json()["data"]

    response = await client.patch(
        f"/api/v1/sms/campaigns/{created['id']}", json={"name": "Renamed", "status": "SCHEDULED"}
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["name"] == "Renamed"
    assert data["status"] == "SCHEDULED"


async def test_patch_rejects_audience_rule_changes(client: AsyncClient) -> None:
    """The recipient snapshot must never change after a campaign is
    created, so the rule that produces it isn't PATCH-able at all."""
    created = (await client.post("/api/v1/sms/campaigns", json=_create_payload())).json()["data"]

    response = await client.patch(
        f"/api/v1/sms/campaigns/{created['id']}",
        json={"audience_rule": {"rule_type": "VIP"}},
    )
    assert response.status_code == 422


async def test_patch_rejects_campaign_type_changes(client: AsyncClient) -> None:
    created = (await client.post("/api/v1/sms/campaigns", json=_create_payload())).json()["data"]

    response = await client.patch(
        f"/api/v1/sms/campaigns/{created['id']}", json={"campaign_type": "BIRTHDAY"}
    )
    assert response.status_code == 422


async def test_patch_message_recomputes_segments(client: AsyncClient) -> None:
    created = (await client.post("/api/v1/sms/campaigns", json=_create_payload())).json()["data"]

    long_message = "A" * 200  # forces 2 GSM-7 segments
    response = await client.patch(
        f"/api/v1/sms/campaigns/{created['id']}", json={"message": long_message}
    )
    assert response.json()["data"]["sms_segments"] == 2


async def test_patch_message_recomputes_cost_once_recipients_are_resolved(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    created = (await client.post("/api/v1/sms/campaigns", json=_create_payload())).json()["data"]
    campaign = (
        await db_session.execute(select(Campaign).where(Campaign.public_id == created["id"]))
    ).scalar_one()
    await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)

    long_message = "A" * 200  # 2 segments instead of 1
    response = await client.patch(
        f"/api/v1/sms/campaigns/{created['id']}", json={"message": long_message}
    )
    data = response.json()["data"]
    assert data["sms_segments"] == 2
    # 0 recipients in this test -> cost is still 0, but it must have been
    # recomputed (not left stale) — verified in the recipients-present case
    # by test_campaign_recipient_snapshot.py's cost math instead.
    assert data["estimated_cost"] == "0.00"


async def test_delete_campaign(client: AsyncClient) -> None:
    created = (await client.post("/api/v1/sms/campaigns", json=_create_payload())).json()["data"]

    response = await client.delete(f"/api/v1/sms/campaigns/{created['id']}")
    assert response.status_code == 204

    response = await client.get(f"/api/v1/sms/campaigns/{created['id']}")
    assert response.status_code == 404


async def test_delete_unknown_campaign_404(client: AsyncClient) -> None:
    response = await client.delete("/api/v1/sms/campaigns/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


async def test_audience_counts(client: AsyncClient, db_session: AsyncSession) -> None:
    await _add_customer(db_session, name="A", phone="+8801711000101")

    response = await client.get("/api/v1/sms/campaigns/audience-counts")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["general"] == 1
    assert set(data.keys()) == {
        "general",
        "vip",
        "vvip",
        "missing_dob",
        "missing_address",
        "missing_dob_and_address",
        "never_verified",
        "targeted_not_verified",
    }


async def test_audience_preview_general(client: AsyncClient, db_session: AsyncSession) -> None:
    await _add_customer(db_session, name="A", phone="+8801711000101")

    response = await client.get(
        "/api/v1/sms/campaigns/audience-preview", params={"rule_type": "GENERAL"}
    )
    assert response.status_code == 200
    assert response.json()["data"]["count"] == 1


async def test_audience_preview_new_since_date_requires_a_date(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/sms/campaigns/audience-preview", params={"rule_type": "NEW_SINCE_DATE"}
    )
    assert response.status_code == 422


async def test_audience_preview_never_received_type(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    campaign = Campaign(
        name="Prior",
        campaign_type="PROFILE_COMPLETION",
        audience_rule_type="GENERAL",
        audience_rule_params={},
        message="hi",
        sender_id="TopTen",
    )
    db_session.add(campaign)
    await db_session.commit()
    await db_session.refresh(campaign)

    received = await _add_customer(db_session, name="Received", phone="+8801711000101")
    await _add_customer(db_session, name="NeverReceived", phone="+8801711000102")
    db_session.add(
        CampaignRecipient(
            campaign_id=campaign.id,
            customer_id=received.id,
            phone=received.phone,
            name=received.name,
        )
    )
    await db_session.commit()

    response = await client.get(
        "/api/v1/sms/campaigns/audience-preview",
        params={"rule_type": "NEVER_RECEIVED_TYPE", "campaign_type": "PROFILE_COMPLETION"},
    )
    assert response.json()["data"]["count"] == 1


async def test_audience_preview_recipients_is_paginated(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    for i in range(3):
        await _add_customer(db_session, name=f"Customer {i}", phone=f"+880171100010{i}")

    response = await client.get(
        "/api/v1/sms/campaigns/audience-preview-recipients",
        params={"rule_type": "GENERAL", "page": 1, "page_size": 2},
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["data"]) == 2
    assert body["meta"]["total"] == 3
    assert body["meta"]["total_pages"] == 2
    assert {"id", "name", "phone"} <= body["data"][0].keys()


async def test_campaign_recipients_lists_the_frozen_snapshot(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    created = (await client.post("/api/v1/sms/campaigns", json=_create_payload())).json()["data"]
    campaign = (
        await db_session.execute(select(Campaign).where(Campaign.public_id == created["id"]))
    ).scalar_one()

    await _add_customer(db_session, name="A", phone="+8801711000101")
    await _add_customer(db_session, name="B", phone="+8801711000102")
    await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)

    response = await client.get(f"/api/v1/sms/campaigns/{created['id']}/recipients")
    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["total"] == 2
    assert len(body["data"]) == 2
    assert {"id", "customer_id", "phone", "status"} <= body["data"][0].keys()


async def test_campaign_recipients_unknown_campaign_404(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/sms/campaigns/00000000-0000-0000-0000-000000000000/recipients"
    )
    assert response.status_code == 404


async def test_campaign_stats_breakdown(client: AsyncClient, db_session: AsyncSession) -> None:
    created = (await client.post("/api/v1/sms/campaigns", json=_create_payload())).json()["data"]
    campaign = (
        await db_session.execute(select(Campaign).where(Campaign.public_id == created["id"]))
    ).scalar_one()

    await _add_customer(db_session, name="A", phone="+8801711000101")
    await _add_customer(db_session, name="B", phone="+8801711000102")
    await resolve_campaign_audience_async(campaign.id, session_factory=TestSessionLocal)

    recipients = (
        (await db_session.execute(select(CampaignRecipient))).scalars().all()
    )
    recipients[0].status = "DELIVERED"
    await db_session.commit()

    response = await client.get(f"/api/v1/sms/campaigns/{created['id']}/stats")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 2
    assert data["delivered"] == 1
    assert data["pending"] == 1
    assert data["sent"] == 0
    assert data["failed"] == 0
