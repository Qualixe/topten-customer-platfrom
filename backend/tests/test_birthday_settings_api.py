"""GET/PUT /api/v1/settings/birthday (protected, requires settings.manage —
see app.controllers.birthday_settings)."""

from httpx import AsyncClient


async def test_defaults_before_any_update(client: AsyncClient) -> None:
    response = await client.get("/api/v1/settings/birthday")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["enabled"] is False
    assert data["channel"] == "SMS"
    assert data["send_hour"] == 9
    assert data["send_minute"] == 0
    assert data["notify_days_before"] == 3
    assert data["last_run_at"] is None


async def test_update_persists_and_round_trips(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/settings/birthday",
        json={
            "notify_days_before": 5,
            "enabled": True,
            "channel": "BOTH",
            "send_hour": 14,
            "send_minute": 45,
            "company_name": "Pulsedesk",
            "message_template": "Happy Birthday, {{customer_name}}! 🎂",
            "email_subject": "Happy Birthday, {{customer_name}}! 🎉",
            "email_message_template": "<p>Happy Birthday, {{customer_name}}!</p>",
            "auto_assign_gift": True,
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["notify_days_before"] == 5
    assert data["enabled"] is True
    assert data["channel"] == "BOTH"
    assert data["send_hour"] == 14
    assert data["send_minute"] == 45
    assert data["company_name"] == "Pulsedesk"
    assert data["message_template"] == "Happy Birthday, {{customer_name}}! 🎂"
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
            "enabled": False,
            "channel": "SMS",
            "send_hour": 9,
            "send_minute": 0,
            "company_name": "",
            "message_template": "   ",
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
            "enabled": False,
            "channel": "SMS",
            "send_hour": 9,
            "send_minute": 0,
            "company_name": "",
            "message_template": "Happy Birthday, {{customer_name}}!",
            "email_subject": "   ",
            "email_message_template": "<p>Happy Birthday!</p>",
            "auto_assign_gift": False,
        },
    )
    assert response.status_code == 422


async def test_invalid_channel_is_rejected(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/settings/birthday",
        json={
            "notify_days_before": 3,
            "enabled": False,
            "channel": "FAX",
            "send_hour": 9,
            "send_minute": 0,
            "company_name": "",
            "message_template": "Happy Birthday, {{customer_name}}!",
            "email_subject": "Happy Birthday, {{customer_name}}!",
            "email_message_template": "<p>Happy Birthday!</p>",
            "auto_assign_gift": False,
        },
    )
    assert response.status_code == 422


async def test_send_hour_out_of_range_is_rejected(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/settings/birthday",
        json={
            "notify_days_before": 3,
            "enabled": False,
            "channel": "SMS",
            "send_hour": 24,
            "send_minute": 0,
            "company_name": "",
            "message_template": "Happy Birthday, {{customer_name}}!",
            "email_subject": "Happy Birthday, {{customer_name}}!",
            "email_message_template": "<p>Happy Birthday!</p>",
            "auto_assign_gift": False,
        },
    )
    assert response.status_code == 422


async def test_send_minute_out_of_range_is_rejected(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/settings/birthday",
        json={
            "notify_days_before": 3,
            "enabled": False,
            "channel": "SMS",
            "send_hour": 9,
            "send_minute": 60,
            "company_name": "",
            "message_template": "Happy Birthday, {{customer_name}}!",
            "email_subject": "Happy Birthday, {{customer_name}}!",
            "email_message_template": "<p>Happy Birthday!</p>",
            "auto_assign_gift": False,
        },
    )
    assert response.status_code == 422


async def test_endpoints_require_auth(unauthenticated_client: AsyncClient) -> None:
    response = await unauthenticated_client.get("/api/v1/settings/birthday")
    assert response.status_code == 401
