"""GET/PUT credentials for the generic SMS gateway and Pathao (couriers) —
two independent provider credential sets.

Secret fields (api_key, client_secret, password) must never be echoed back
in a response body — only whether they're currently set.
"""

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.common import sms_gateway_client

DEFAULT_FIELD_MAPPING = {
    "request_style": {"is_secret": False, "value": "GET_QUERY"},
    "api_key_field": {"is_secret": False, "value": "api_key"},
    "sender_id_field": {"is_secret": False, "value": "senderid"},
    "number_field": {"is_secret": False, "value": "number"},
    "message_field": {"is_secret": False, "value": "message"},
    "request_id_field": {"is_secret": False, "value": None},
    "success_field": {"is_secret": False, "value": None},
    "success_value": {"is_secret": False, "value": None},
}


async def test_sms_gateway_credentials_start_unset(client: AsyncClient) -> None:
    response = await client.get("/api/v1/notifications/sms-gateway/credentials")
    assert response.status_code == 200
    assert response.json()["data"] == {
        "api_url": {"is_secret": False, "value": None},
        "api_key": {"is_secret": True, "is_set": False},
        "sender_id": {"is_secret": False, "value": None},
        "rate_per_segment_bdt": {"is_secret": False, "value": "0.45"},
        **DEFAULT_FIELD_MAPPING,
    }


async def test_setting_sms_gateway_api_key_never_echoes_it_back(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/notifications/sms-gateway/credentials",
        json={
            "api_url": "https://example.com/api/smsapi",
            "api_key": "super-secret-key",
            "sender_id": "TOPTEN",
        },
    )
    assert response.status_code == 200

    data = response.json()["data"]
    assert data["api_url"] == {"is_secret": False, "value": "https://example.com/api/smsapi"}
    assert data["api_key"] == {"is_secret": True, "is_set": True}
    assert data["sender_id"] == {"is_secret": False, "value": "TOPTEN"}
    assert "super-secret-key" not in response.text


async def test_custom_field_mapping_round_trips(client: AsyncClient) -> None:
    """The whole point of this config surface — mirrors SSL Wireless SMS
    Plus's actual contract (POST/JSON, api_token/sid/msisdn/sms, a
    csms_id correlation field, and success judged by status_code==200
    rather than HTTP status alone)."""
    response = await client.put(
        "/api/v1/notifications/sms-gateway/credentials",
        json={
            "request_style": "POST_JSON",
            "api_key_field": "api_token",
            "sender_id_field": "sid",
            "number_field": "msisdn",
            "message_field": "sms",
            "request_id_field": "csms_id",
            "success_field": "status_code",
            "success_value": "200",
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["request_style"] == {"is_secret": False, "value": "POST_JSON"}
    assert data["api_key_field"] == {"is_secret": False, "value": "api_token"}
    assert data["sender_id_field"] == {"is_secret": False, "value": "sid"}
    assert data["number_field"] == {"is_secret": False, "value": "msisdn"}
    assert data["message_field"] == {"is_secret": False, "value": "sms"}
    assert data["request_id_field"] == {"is_secret": False, "value": "csms_id"}
    assert data["success_field"] == {"is_secret": False, "value": "status_code"}
    assert data["success_value"] == {"is_secret": False, "value": "200"}


async def test_invalid_request_style_rejected(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/notifications/sms-gateway/credentials",
        json={"request_style": "DELETE_XML"},
    )
    assert response.status_code == 422


async def test_updating_sender_id_does_not_clear_the_api_key(client: AsyncClient) -> None:
    await client.put(
        "/api/v1/notifications/sms-gateway/credentials", json={"api_key": "abc123"}
    )

    response = await client.put(
        "/api/v1/notifications/sms-gateway/credentials", json={"sender_id": "TOPTEN"}
    )
    data = response.json()["data"]
    assert data["api_key"]["is_set"] is True
    assert data["sender_id"]["value"] == "TOPTEN"


async def test_sending_blank_api_key_clears_it(client: AsyncClient) -> None:
    await client.put("/api/v1/notifications/sms-gateway/credentials", json={"api_key": "abc123"})

    response = await client.put(
        "/api/v1/notifications/sms-gateway/credentials", json={"api_key": ""}
    )
    assert response.json()["data"]["api_key"]["is_set"] is False


async def test_api_url_must_be_http_or_https(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/notifications/sms-gateway/credentials",
        json={"api_url": "not-a-url"},
    )
    assert response.status_code == 422


async def test_setting_rate_per_segment_bdt(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/notifications/sms-gateway/credentials",
        json={"rate_per_segment_bdt": "0.60"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["rate_per_segment_bdt"] == {
        "is_secret": False,
        "value": "0.60",
    }


async def test_blank_rate_per_segment_bdt_resets_to_default(client: AsyncClient) -> None:
    await client.put(
        "/api/v1/notifications/sms-gateway/credentials",
        json={"rate_per_segment_bdt": "0.60"},
    )
    response = await client.put(
        "/api/v1/notifications/sms-gateway/credentials",
        json={"rate_per_segment_bdt": ""},
    )
    assert response.json()["data"]["rate_per_segment_bdt"]["value"] == "0.45"


async def test_negative_rate_per_segment_bdt_rejected(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/notifications/sms-gateway/credentials",
        json={"rate_per_segment_bdt": "-0.10"},
    )
    assert response.status_code == 422


async def test_non_numeric_rate_per_segment_bdt_rejected(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/notifications/sms-gateway/credentials",
        json={"rate_per_segment_bdt": "not-a-number"},
    )
    assert response.status_code == 422


async def test_pathao_credentials_start_unset(client: AsyncClient) -> None:
    response = await client.get("/api/v1/couriers/pathao/credentials")
    assert response.status_code == 200
    assert response.json()["data"] == {
        "client_id": {"is_secret": False, "value": None},
        "client_secret": {"is_secret": True, "is_set": False},
        "username": {"is_secret": False, "value": None},
        "password": {"is_secret": True, "is_set": False},
    }


async def test_setting_pathao_credentials_never_echoes_secrets_back(client: AsyncClient) -> None:
    response = await client.put(
        "/api/v1/couriers/pathao/credentials",
        json={
            "client_id": "pathao-client-123",
            "client_secret": "top-secret",
            "username": "store@topten.com.bd",
            "password": "hunter2",
        },
    )
    assert response.status_code == 200

    data = response.json()["data"]
    assert data["client_id"] == {"is_secret": False, "value": "pathao-client-123"}
    assert data["client_secret"] == {"is_secret": True, "is_set": True}
    assert data["username"] == {"is_secret": False, "value": "store@topten.com.bd"}
    assert data["password"] == {"is_secret": True, "is_set": True}
    assert "top-secret" not in response.text
    assert "hunter2" not in response.text


async def test_pathao_credentials_persist_across_requests(client: AsyncClient) -> None:
    await client.put(
        "/api/v1/couriers/pathao/credentials",
        json={"client_id": "abc", "client_secret": "s3cr3t"},
    )

    response = await client.get("/api/v1/couriers/pathao/credentials")
    data = response.json()["data"]
    assert data["client_id"]["value"] == "abc"
    assert data["client_secret"]["is_set"] is True


async def test_test_sms_requires_credentials_first(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/notifications/sms-gateway/test-sms",
        json={"number": "01711000101", "message": "hello"},
    )
    assert response.status_code == 422


async def test_test_sms_sends_with_saved_credentials(client: AsyncClient) -> None:
    """Never hits a real gateway in tests — `send_sms` is mocked at the
    point the endpoint calls it, and the assertions cover that the endpoint
    threads the saved URL/credentials and a normalized phone number through
    correctly."""
    await client.put(
        "/api/v1/notifications/sms-gateway/credentials",
        json={
            "api_url": "https://example.com/api/smsapi",
            "api_key": "abc123",
            "sender_id": "TOPTEN",
        },
    )

    mock_result = sms_gateway_client.SendSmsResult(success=True, http_status=200, message="OK")
    with patch(
        "app.controllers.notifications.send_sms",
        new=AsyncMock(return_value=mock_result),
    ) as mock_send:
        response = await client.post(
            "/api/v1/notifications/sms-gateway/test-sms",
            json={"number": "01711000101", "message": "hello from a test"},
        )

    assert response.status_code == 200
    assert response.json()["data"] == {
        "success": True,
        "http_status": 200,
        "message": "OK",
    }
    mock_send.assert_awaited_once_with(
        api_url="https://example.com/api/smsapi",
        api_key="abc123",
        sender_id="TOPTEN",
        number="+8801711000101",
        message="hello from a test",
        request_style=sms_gateway_client.RequestStyle.GET_QUERY,
        api_key_field="api_key",
        sender_id_field="senderid",
        number_field="number",
        message_field="message",
        request_id_field=None,
        success_field=None,
        success_value=None,
    )


async def test_test_sms_threads_saved_custom_field_mapping_to_the_client(
    client: AsyncClient,
) -> None:
    """Complements `test_sms_gateway_client.py`'s unit coverage of the
    request-building/success-judging logic itself: this proves the
    *endpoint* actually reads the saved SSL-Wireless-style config (not just
    the defaults) out of the DB and threads it through to `send_sms`,
    rather than silently ignoring it."""
    await client.put(
        "/api/v1/notifications/sms-gateway/credentials",
        json={
            "api_url": "https://smsplus.sslwireless.com/api/v3/send-sms",
            "api_key": "real-token",
            "sender_id": "8809648910392",
            "request_style": "POST_JSON",
            "api_key_field": "api_token",
            "sender_id_field": "sid",
            "number_field": "msisdn",
            "message_field": "sms",
            "request_id_field": "csms_id",
            "success_field": "status_code",
            "success_value": "200",
        },
    )

    mock_result = sms_gateway_client.SendSmsResult(success=False, http_status=200, message="")
    with patch(
        "app.controllers.notifications.send_sms",
        new=AsyncMock(return_value=mock_result),
    ) as mock_send:
        await client.post(
            "/api/v1/notifications/sms-gateway/test-sms",
            json={"number": "01711000101", "message": "hi"},
        )

    mock_send.assert_awaited_once_with(
        api_url="https://smsplus.sslwireless.com/api/v3/send-sms",
        api_key="real-token",
        sender_id="8809648910392",
        number="+8801711000101",
        message="hi",
        request_style=sms_gateway_client.RequestStyle.POST_JSON,
        api_key_field="api_token",
        sender_id_field="sid",
        number_field="msisdn",
        message_field="sms",
        request_id_field="csms_id",
        success_field="status_code",
        success_value="200",
    )


async def test_test_sms_surfaces_provider_failure(client: AsyncClient) -> None:
    await client.put(
        "/api/v1/notifications/sms-gateway/credentials",
        json={
            "api_url": "https://example.com/api/smsapi",
            "api_key": "bad-key",
            "sender_id": "TOPTEN",
        },
    )

    mock_result = sms_gateway_client.SendSmsResult(
        success=False, http_status=401, message="Unauthorized"
    )
    with patch(
        "app.controllers.notifications.send_sms",
        new=AsyncMock(return_value=mock_result),
    ):
        response = await client.post(
            "/api/v1/notifications/sms-gateway/test-sms",
            json={"number": "01711000101", "message": "hello"},
        )

    assert response.status_code == 200
    assert response.json()["data"] == {
        "success": False,
        "http_status": 401,
        "message": "Unauthorized",
    }


async def test_test_sms_rejects_invalid_number(client: AsyncClient) -> None:
    await client.put(
        "/api/v1/notifications/sms-gateway/credentials",
        json={
            "api_url": "https://example.com/api/smsapi",
            "api_key": "abc123",
            "sender_id": "TOPTEN",
        },
    )

    response = await client.post(
        "/api/v1/notifications/sms-gateway/test-sms",
        json={"number": "not-a-number", "message": "hi"},
    )
    assert response.status_code == 422
