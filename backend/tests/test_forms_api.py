"""CRUD for /api/v1/forms (the standalone Form Builder), plus attaching a
saved form to a campaign so it can actually be sent (POST
/api/v1/sms/campaigns/{id}/landing-page/from-form/{form_id}).
"""

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.campaign import Campaign
from app.models.role import Role
from app.models.user import User

VALID_BUILDER_DATA = {
    "version": 1,
    "fields": [
        {"id": "field-1", "type": "heading", "label": "Complete Your Profile"},
        {"id": "field-2", "type": "date_of_birth", "label": "Date of Birth", "required": True},
        {"id": "field-3", "type": "address", "label": "Address", "required": True},
        {"id": "field-4", "type": "text", "label": "Favourite Store", "required": False},
        {"id": "field-5", "type": "phone", "label": "Alternate Phone", "required": False},
        {"id": "field-6", "type": "submit_button", "label": "Submit"},
    ],
}


async def _create_campaign(db_session: AsyncSession, *, name: str = "VIP Campaign") -> Campaign:
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


async def _staff_headers(db_session: AsyncSession, *, email: str) -> dict[str, str]:
    role = (await db_session.execute(select(Role).where(Role.name == "Staff"))).scalar_one()
    staff = User(
        email=email,
        hashed_password=hash_password("some-password-123"),
        name="Staff",
        role_id=role.id,
    )
    db_session.add(staff)
    await db_session.commit()
    await db_session.refresh(staff)
    token = create_access_token(user_public_id=str(staff.public_id))
    return {"Authorization": f"Bearer {token}"}


async def test_create_form(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/forms", json={"name": "Customer Information", "description": "Basic profile."}
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == "Customer Information"
    assert data["status"] == "DRAFT"

    # A new form starts from a sensible default template rather than a
    # blank canvas — one that already includes the two fields a real
    # submission actually requires (date_of_birth, address).
    field_types = [field["type"] for field in data["builder_data"]["fields"]]
    assert field_types == [
        "heading",
        "name",
        "phone",
        "date_of_birth",
        "address",
        "email",
        "submit_button",
    ]
    field_ids = [field["id"] for field in data["builder_data"]["fields"]]
    assert len(field_ids) == len(set(field_ids))


async def test_list_forms_supports_search(client: AsyncClient) -> None:
    await client.post("/api/v1/forms", json={"name": "Birthday Form", "description": ""})
    await client.post("/api/v1/forms", json={"name": "VIP Profile", "description": ""})

    response = await client.get("/api/v1/forms", params={"search": "birthday"})
    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["total"] == 1
    assert body["data"][0]["name"] == "Birthday Form"


async def test_update_form_saves_builder_data(client: AsyncClient) -> None:
    create_response = await client.post("/api/v1/forms", json={"name": "Draft Form"})
    form_id = create_response.json()["data"]["id"]

    response = await client.patch(
        f"/api/v1/forms/{form_id}", json={"builder_data": VALID_BUILDER_DATA}
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data["builder_data"]["fields"]) == 6


async def test_status_is_derived_from_published_not_independently_settable(
    client: AsyncClient,
) -> None:
    """`status` (DRAFT/PUBLISHED) always reflects `published` — it can't
    drift out of sync because there's nothing else that sets it."""
    create_response = await client.post("/api/v1/forms", json={"name": "Draft Form"})
    form_id = create_response.json()["data"]["id"]
    assert create_response.json()["data"]["status"] == "DRAFT"

    # Sending "status" directly is rejected — extra="forbid", no such field.
    rejected = await client.patch(f"/api/v1/forms/{form_id}", json={"status": "PUBLISHED"})
    assert rejected.status_code == 422

    published = await client.patch(
        f"/api/v1/forms/{form_id}", json={"slug": "derived-status-form", "published": True}
    )
    assert published.status_code == 200
    assert published.json()["data"]["status"] == "PUBLISHED"

    unpublished = await client.patch(f"/api/v1/forms/{form_id}", json={"published": False})
    assert unpublished.status_code == 200
    assert unpublished.json()["data"]["status"] == "DRAFT"


async def test_delete_form(client: AsyncClient) -> None:
    create_response = await client.post("/api/v1/forms", json={"name": "Temporary"})
    form_id = create_response.json()["data"]["id"]

    delete_response = await client.delete(f"/api/v1/forms/{form_id}")
    assert delete_response.status_code == 204

    get_response = await client.get(f"/api/v1/forms/{form_id}")
    assert get_response.status_code == 404


async def test_duplicate_form_gets_new_id_and_field_ids(client: AsyncClient) -> None:
    create_response = await client.post("/api/v1/forms", json={"name": "Customer Information"})
    form_id = create_response.json()["data"]["id"]
    await client.patch(f"/api/v1/forms/{form_id}", json={"builder_data": VALID_BUILDER_DATA})

    duplicate_response = await client.post(f"/api/v1/forms/{form_id}/duplicate")
    assert duplicate_response.status_code == 201
    copy = duplicate_response.json()["data"]

    assert copy["id"] != form_id
    assert copy["name"] == "Customer Information Copy"
    assert copy["status"] == "DRAFT"

    original_field_ids = {f["id"] for f in VALID_BUILDER_DATA["fields"]}
    copy_field_ids = {f["id"] for f in copy["builder_data"]["fields"]}
    assert original_field_ids.isdisjoint(copy_field_ids)
    assert len(copy_field_ids) == len(original_field_ids)


async def test_invalid_field_type_is_rejected(client: AsyncClient) -> None:
    create_response = await client.post("/api/v1/forms", json={"name": "Bad Form"})
    form_id = create_response.json()["data"]["id"]

    response = await client.patch(
        f"/api/v1/forms/{form_id}",
        json={"builder_data": {"version": 1, "fields": [{"id": "x", "type": "signature"}]}},
    )
    assert response.status_code == 422


async def test_invalid_builder_json_shape_is_rejected(client: AsyncClient) -> None:
    create_response = await client.post("/api/v1/forms", json={"name": "Bad Form"})
    form_id = create_response.json()["data"]["id"]

    response = await client.patch(
        f"/api/v1/forms/{form_id}",
        json={"builder_data": {"version": 1, "fields": [], "columns": True}},
    )
    assert response.status_code == 422


async def test_staff_can_view_but_not_manage_forms(
    unauthenticated_client: AsyncClient, admin_user: User, db_session: AsyncSession
) -> None:
    headers = await _staff_headers(db_session, email="staff.forms@topten.com.bd")

    list_response = await unauthenticated_client.get("/api/v1/forms", headers=headers)
    assert list_response.status_code == 200

    create_response = await unauthenticated_client.post(
        "/api/v1/forms", headers=headers, json={"name": "Nope"}
    )
    assert create_response.status_code == 403


async def test_attach_form_to_campaign_creates_landing_page(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    campaign = await _create_campaign(db_session)
    create_response = await client.post("/api/v1/forms", json={"name": "Customer Information"})
    form_id = create_response.json()["data"]["id"]
    await client.patch(f"/api/v1/forms/{form_id}", json={"builder_data": VALID_BUILDER_DATA})

    response = await client.post(
        f"/api/v1/sms/campaigns/{campaign.public_id}/landing-page/from-form/{form_id}"
    )
    assert response.status_code == 201
    body = response.json()
    data = body["data"]
    assert data["name"] == "Customer Information"
    assert data["published"] is False

    # heading, date_of_birth, address, submit_button map to blocks; the
    # generic Text Input and Phone fields have no supported block type.
    block_types = {block["type"] for block in data["builder_data"]["blocks"]}
    assert block_types == {"heading", "date_of_birth", "address", "button"}
    assert sorted(body["meta"]["skipped_field_labels"]) == ["Alternate Phone", "Favourite Store"]

    landing_page_response = await client.get(
        f"/api/v1/sms/campaigns/{campaign.public_id}/landing-page"
    )
    assert landing_page_response.status_code == 200
    assert len(landing_page_response.json()["data"]["builder_data"]["blocks"]) == 4


async def test_attach_form_to_campaign_carries_over_heading_align_and_size(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """A heading's alignment/size, set in the form builder, must survive
    conversion into a campaign landing page block instead of silently
    reverting to the block's left/medium default."""
    campaign = await _create_campaign(db_session)
    create_response = await client.post("/api/v1/forms", json={"name": "Styled Heading Form"})
    form_id = create_response.json()["data"]["id"]
    await client.patch(
        f"/api/v1/forms/{form_id}",
        json={
            "builder_data": {
                "version": 1,
                "fields": [
                    {
                        "id": "field-1",
                        "type": "heading",
                        "label": "Welcome!",
                        "align": "center",
                        "size": "lg",
                    }
                ],
            }
        },
    )

    response = await client.post(
        f"/api/v1/sms/campaigns/{campaign.public_id}/landing-page/from-form/{form_id}"
    )
    assert response.status_code == 201
    heading_block = response.json()["data"]["builder_data"]["blocks"][0]
    assert heading_block["type"] == "heading"
    assert heading_block["content"]["align"] == "center"
    assert heading_block["content"]["size"] == "lg"


async def test_attach_form_to_campaign_carries_over_paragraph_align(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Same as heading alignment — a paragraph's alignment must also
    survive the conversion into a campaign landing page's text block."""
    campaign = await _create_campaign(db_session)
    create_response = await client.post("/api/v1/forms", json={"name": "Styled Paragraph Form"})
    form_id = create_response.json()["data"]["id"]
    await client.patch(
        f"/api/v1/forms/{form_id}",
        json={
            "builder_data": {
                "version": 1,
                "fields": [
                    {
                        "id": "field-1",
                        "type": "paragraph",
                        "label": "Some body copy.",
                        "align": "right",
                    }
                ],
            }
        },
    )

    response = await client.post(
        f"/api/v1/sms/campaigns/{campaign.public_id}/landing-page/from-form/{form_id}"
    )
    assert response.status_code == 201
    text_block = response.json()["data"]["builder_data"]["blocks"][0]
    assert text_block["type"] == "text"
    assert text_block["content"]["align"] == "right"
    assert "size" not in text_block["content"]


async def test_attach_form_to_campaign_overwrites_existing_landing_page_blocks(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    campaign = await _create_campaign(db_session)
    await client.post(
        f"/api/v1/sms/campaigns/{campaign.public_id}/landing-page",
        json={
            "name": "Manually Built",
            "slug": "manually-built",
            "builder_data": {
                "version": 1,
                "blocks": [{"id": "old-1", "type": "heading", "content": {"text": "Old"}}],
            },
            "published": True,
        },
    )

    create_response = await client.post("/api/v1/forms", json={"name": "New Form"})
    form_id = create_response.json()["data"]["id"]
    await client.patch(f"/api/v1/forms/{form_id}", json={"builder_data": VALID_BUILDER_DATA})

    response = await client.post(
        f"/api/v1/sms/campaigns/{campaign.public_id}/landing-page/from-form/{form_id}"
    )
    assert response.status_code == 201
    data = response.json()["data"]

    # Slug and published state are untouched — attaching only replaces the
    # blocks, it doesn't unpublish a page that was already live.
    assert data["slug"] == "manually-built"
    assert data["published"] is True
    assert len(data["builder_data"]["blocks"]) == 4
