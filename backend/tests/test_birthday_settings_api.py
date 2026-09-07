"""GET/PUT /api/v1/settings/birthday (protected, requires settings.manage —
see app.controllers.birthday_settings)."""

from httpx import AsyncClient


async def test_defaults_before_any_update(client: AsyncClient) -> None:
    response = await client.get("/api/v1/settings/birthday")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["auto_send_message"] is False
    assert data["auto_send_email"] is False
    assert data["notify_days_before"] == 3


async def test_update_persists_and_round_trips(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/settings/birthday",
        json={
            "notify_days_before": 5,
            "auto_send_message": True,
            "message_template": "Happy Birthday, {{customer_name}}! 🎂",
            "auto_send_email": True,
            "email_subject": "Happy Birthday, {{customer_name}}! 🎉",
            "email_message_template": "<p>Happy Birthday, {{customer_name}}!</p>",
            "auto_assign_gift": True,
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["notify_days_before"] == 5
    assert data["auto_send_message"] is True
    assert data["message_template"] == "Happy Birthday, {{customer_name}}! 🎂"
    assert data["auto_send_email"] is True
    assert data["email_subject"] == "Happy Birthday, {{customer_name}}! 🎉"
    assert data["email_message_template"] == "<p>Happy Birthday, {{customer_name}}!</p>"
    assert data["auto_assign_gift"] is True

    follow_up = await client.get("/api/v1/settings/birthday")
    assert follow_up.json()["data"] == data


async def test_blank_template_is_rejected(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/settings/birthday",
        json={
            "notify_days_before": 3,
            "auto_send_message": False,
            "message_template": "   ",
            "auto_send_email": False,
            "email_subject": "Happy Birthday, {{customer_name}}!",
            "email_message_template": "<p>Happy Birthday!</p>",
            "auto_assign_gift": False,
        },
    )
    assert response.status_code == 422


async def test_blank_email_subject_is_rejected(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/settings/birthday",
        json={
            "notify_days_before": 3,
            "auto_send_message": False,
            "message_template": "Happy Birthday, {{customer_name}}!",
            "auto_send_email": False,
            "email_subject": "   ",
            "email_message_template": "<p>Happy Birthday!</p>",
            "auto_assign_gift": False,
        },
    )
    assert response.status_code == 422


async def test_endpoints_require_auth(unauthenticated_client: AsyncClient) -> None:
    response = await unauthenticated_client.get("/api/v1/settings/birthday")
    assert response.status_code == 401
