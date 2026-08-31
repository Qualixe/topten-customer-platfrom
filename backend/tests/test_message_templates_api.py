"""CRUD for /api/v1/message-templates, and the channel-conditional subject rule."""

from httpx import AsyncClient


async def test_create_sms_template(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/message-templates",
        json={"name": "Welcome SMS", "channel": "SMS", "body": "Hi {{customer_name}}!"},
    )
    assert response.status_code == 201
    body = response.json()["data"]
    assert body["name"] == "Welcome SMS"
    assert body["channel"] == "SMS"
    assert body["subject"] is None


async def test_create_email_template_requires_subject(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/message-templates",
        json={"name": "Welcome Email", "channel": "EMAIL", "body": "Hi there"},
    )
    assert response.status_code == 422


async def test_create_email_template_with_subject(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/message-templates",
        json={
            "name": "Welcome Email",
            "channel": "EMAIL",
            "subject": "Welcome!",
            "body": "Hi {{customer_name}}, welcome aboard.",
        },
    )
    assert response.status_code == 201
    body = response.json()["data"]
    assert body["subject"] == "Welcome!"


async def test_list_templates_filters_by_channel(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/message-templates",
        json={"name": "SMS one", "channel": "SMS", "body": "Hi"},
    )
    await client.post(
        "/api/v1/message-templates",
        json={"name": "Email one", "channel": "EMAIL", "subject": "Hi", "body": "Hi"},
    )

    response = await client.get("/api/v1/message-templates", params={"channel": "EMAIL"})
    body = response.json()
    assert body["meta"]["total"] == 1
    assert body["data"][0]["name"] == "Email one"


async def test_update_template_body(client: AsyncClient) -> None:
    created = (
        await client.post(
            "/api/v1/message-templates",
            json={"name": "Draft", "channel": "SMS", "body": "old body"},
        )
    ).json()["data"]

    response = await client.patch(
        f"/api/v1/message-templates/{created['id']}", json={"body": "new body"}
    )
    assert response.status_code == 200
    assert response.json()["data"]["body"] == "new body"


async def test_cannot_clear_subject_on_email_template(client: AsyncClient) -> None:
    created = (
        await client.post(
            "/api/v1/message-templates",
            json={"name": "Email", "channel": "EMAIL", "subject": "Hi", "body": "Hi"},
        )
    ).json()["data"]

    response = await client.patch(
        f"/api/v1/message-templates/{created['id']}", json={"subject": ""}
    )
    assert response.status_code in (400, 422)


async def test_delete_template(client: AsyncClient) -> None:
    created = (
        await client.post(
            "/api/v1/message-templates",
            json={"name": "To delete", "channel": "SMS", "body": "Hi"},
        )
    ).json()["data"]

    delete_response = await client.delete(f"/api/v1/message-templates/{created['id']}")
    assert delete_response.status_code == 204

    get_response = await client.get(f"/api/v1/message-templates/{created['id']}")
    assert get_response.status_code == 404


async def test_requires_authentication(unauthenticated_client: AsyncClient) -> None:
    response = await unauthenticated_client.get("/api/v1/message-templates")
    assert response.status_code == 401
