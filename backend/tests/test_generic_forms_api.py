"""Publishing a form as an open, tokenless public form (PATCH
/api/v1/forms/{id} with slug+published), and its public counterparts:
GET/POST /api/v1/public/forms/{slug} — unlike the token-based
/public/customer-profile/{token} flow, this creates or finds a Customer by
phone rather than updating one already identified by a token.
"""

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer

BUILDER_DATA_NAME_PHONE_ONLY = {
    "version": 1,
    "fields": [
        {"id": "f1", "type": "name", "label": "Full Name", "required": True},
        {"id": "f2", "type": "phone", "label": "Phone", "required": True},
        {"id": "f3", "type": "submit_button", "label": "Sign up"},
    ],
}

BUILDER_DATA_WITH_REQUIRED_EMAIL = {
    "version": 1,
    "fields": [
        {"id": "f1", "type": "name", "label": "Full Name", "required": True},
        {"id": "f2", "type": "phone", "label": "Phone", "required": True},
        {"id": "f3", "type": "email", "label": "Email", "required": True},
        {"id": "f4", "type": "date_of_birth", "label": "Date of Birth", "required": False},
        {"id": "f5", "type": "address", "label": "Address", "required": False},
    ],
}


async def _create_and_publish_form(
    client: AsyncClient, *, slug: str, builder_data: dict, name: str = "Open Signup Form"
) -> str:
    create_response = await client.post("/api/v1/forms", json={"name": name})
    form_id = create_response.json()["data"]["id"]
    await client.patch(f"/api/v1/forms/{form_id}", json={"builder_data": builder_data})
    response = await client.patch(
        f"/api/v1/forms/{form_id}", json={"slug": slug, "published": True}
    )
    assert response.status_code == 200
    return form_id


async def test_publishing_requires_a_slug(client: AsyncClient) -> None:
    create_response = await client.post("/api/v1/forms", json={"name": "No Slug Form"})
    form_id = create_response.json()["data"]["id"]

    response = await client.patch(f"/api/v1/forms/{form_id}", json={"published": True})
    assert response.status_code == 422


async def test_publishing_rejects_duplicate_slug(client: AsyncClient) -> None:
    await _create_and_publish_form(
        client, slug="signup", builder_data=BUILDER_DATA_NAME_PHONE_ONLY, name="First"
    )
    create_response = await client.post("/api/v1/forms", json={"name": "Second"})
    form_id = create_response.json()["data"]["id"]

    response = await client.patch(f"/api/v1/forms/{form_id}", json={"slug": "signup"})
    assert response.status_code == 422


async def test_publishing_rejects_a_reserved_slug(client: AsyncClient) -> None:
    """A published form lives at the site root (mysite.com/{slug}) — a
    slug matching an existing top-level route (e.g. "login") would
    silently become unreachable, since that route always wins."""
    create_response = await client.post("/api/v1/forms", json={"name": "Sneaky Slug"})
    form_id = create_response.json()["data"]["id"]

    response = await client.patch(f"/api/v1/forms/{form_id}", json={"slug": "login"})
    assert response.status_code == 422
    # A @field_validator ValueError (as opposed to a manually raised
    # ValidationAppError) must still come back as a plain string, not
    # FastAPI's default list-of-error-objects — see
    # app.common.exceptions.request_validation_exception_handler. The raw
    # array shape breaks every frontend caller expecting `detail: string`.
    detail = response.json()["detail"]
    assert isinstance(detail, str)
    assert "reserved page" in detail


async def test_public_form_get_returns_only_content(client: AsyncClient) -> None:
    await _create_and_publish_form(
        client, slug="open-signup", builder_data=BUILDER_DATA_NAME_PHONE_ONLY
    )

    response = await client.get("/api/v1/public/forms/open-signup")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["name"] == "Open Signup Form"
    assert "id" not in data
    assert len(data["builder_data"]["fields"]) == 3


async def test_unpublished_form_404s_publicly(client: AsyncClient) -> None:
    create_response = await client.post("/api/v1/forms", json={"name": "Draft Form"})
    form_id = create_response.json()["data"]["id"]
    await client.patch(f"/api/v1/forms/{form_id}", json={"slug": "still-draft"})

    response = await client.get("/api/v1/public/forms/still-draft")
    assert response.status_code == 404


async def test_submit_creates_a_new_customer(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _create_and_publish_form(
        client, slug="new-customer-signup", builder_data=BUILDER_DATA_NAME_PHONE_ONLY
    )

    response = await client.post(
        "/api/v1/public/forms/new-customer-signup/submit",
        json={"name": "Rahim Uddin", "phone": "01711000111"},
    )
    assert response.status_code == 200

    customer = (
        await db_session.execute(select(Customer).where(Customer.name == "Rahim Uddin"))
    ).scalar_one()
    assert customer.normalized_phone == "+8801711000111"


async def test_submit_twice_with_same_phone_updates_not_duplicates(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _create_and_publish_form(
        client, slug="repeat-signup", builder_data=BUILDER_DATA_WITH_REQUIRED_EMAIL
    )

    await client.post(
        "/api/v1/public/forms/repeat-signup/submit",
        json={
            "name": "Karim",
            "phone": "01711000222",
            "email": "karim@example.com",
            "address": "House 5, Dhaka",
        },
    )
    await client.post(
        "/api/v1/public/forms/repeat-signup/submit",
        json={"name": "Karim Rahman", "phone": "01711000222", "email": "karim@example.com"},
    )

    customers = (
        await db_session.execute(
            select(Customer).where(Customer.normalized_phone == "+8801711000222")
        )
    ).scalars().all()
    assert len(customers) == 1
    # Name updates from the newer submission, but address (omitted the
    # second time) is never blanked out by a later submission.
    assert customers[0].name == "Karim Rahman"
    assert customers[0].address == "House 5, Dhaka"


async def test_submit_rejects_missing_field_the_form_marks_required(
    client: AsyncClient,
) -> None:
    await _create_and_publish_form(
        client, slug="email-required-signup", builder_data=BUILDER_DATA_WITH_REQUIRED_EMAIL
    )

    response = await client.post(
        "/api/v1/public/forms/email-required-signup/submit",
        json={"name": "No Email", "phone": "01711000333"},
    )
    assert response.status_code == 422


async def test_submit_rejects_invalid_phone(client: AsyncClient) -> None:
    await _create_and_publish_form(
        client, slug="bad-phone-signup", builder_data=BUILDER_DATA_NAME_PHONE_ONLY
    )

    response = await client.post(
        "/api/v1/public/forms/bad-phone-signup/submit",
        json={"name": "Bad Phone", "phone": "not-a-phone"},
    )
    assert response.status_code == 422


async def test_submit_rejects_address_shorter_than_ten_characters(client: AsyncClient) -> None:
    """Matches Pathao's own minimum for a shippable address — checked
    whenever an address is given, even though this form doesn't mark it
    required."""
    await _create_and_publish_form(
        client, slug="short-address-signup", builder_data=BUILDER_DATA_WITH_REQUIRED_EMAIL
    )

    response = await client.post(
        "/api/v1/public/forms/short-address-signup/submit",
        json={
            "name": "Short Address",
            "phone": "01711000444",
            "email": "short@example.com",
            "address": "Dhaka",
        },
    )
    assert response.status_code == 422
    assert "10 characters" in response.json()["detail"]


async def test_submit_to_unpublished_form_404s(client: AsyncClient) -> None:
    create_response = await client.post("/api/v1/forms", json={"name": "Draft Signup"})
    form_id = create_response.json()["data"]["id"]
    await client.patch(f"/api/v1/forms/{form_id}", json={"slug": "draft-signup"})

    response = await client.post(
        "/api/v1/public/forms/draft-signup/submit",
        json={"name": "Nope", "phone": "01711000444"},
    )
    assert response.status_code == 404
