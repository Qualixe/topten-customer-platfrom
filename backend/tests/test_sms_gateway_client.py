"""Request-building and response-judging behavior of the generic SMS
gateway client — mocks the HTTP layer so these never depend on network
access or a real provider."""

from unittest.mock import AsyncMock, patch

import httpx

from app.common.sms_gateway_client import RequestStyle, get_balance, send_sms


def _mock_response(status_code: int, text: str) -> httpx.Response:
    return httpx.Response(
        status_code, text=text, request=httpx.Request("GET", "https://example.com/sms-api")
    )


async def test_get_query_success_on_2xx() -> None:
    response = _mock_response(200, '{"response_code":202,"success_message":"OK"}')
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=response)) as mock_get:
        result = await send_sms(
            api_url="https://example.com/sms-api",
            api_key="key",
            sender_id="TOPTEN",
            number="+8801711000101",
            message="hi",
        )

    assert result.success is True
    assert result.http_status == 200
    args, kwargs = mock_get.call_args
    assert args[0] == "https://example.com/sms-api"
    assert kwargs["params"] == {
        "api_key": "key",
        "senderid": "TOPTEN",
        "number": "+8801711000101",
        "message": "hi",
    }


async def test_get_query_failure_on_non_2xx() -> None:
    response = _mock_response(401, "Unauthorized: bad api key")
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=response)):
        result = await send_sms(
            api_url="https://example.com/sms-api",
            api_key="bad-key",
            sender_id="TOPTEN",
            number="+8801711000101",
            message="hi",
        )

    assert result.success is False
    assert result.http_status == 401


async def test_post_json_uses_custom_field_names_and_request_id() -> None:
    """Reproduces the SSL Wireless SMS Plus contract: POST, JSON body,
    api_token/sid/msisdn/sms field names, plus a generated csms_id."""
    response = _mock_response(200, '{"status":"SUCCESS","status_code":200}')
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=response)) as mock_post:
        result = await send_sms(
            api_url="https://smsplus.sslwireless.com/api/v3/send-sms",
            api_key="token",
            sender_id="8809648910392",
            number="+8801711000101",
            message="hi",
            request_style=RequestStyle.POST_JSON,
            api_key_field="api_token",
            sender_id_field="sid",
            number_field="msisdn",
            message_field="sms",
            request_id_field="csms_id",
            success_field="status_code",
            success_value="200",
        )

    assert result.success is True
    _, kwargs = mock_post.call_args
    body = kwargs["json"]
    assert body["api_token"] == "token"
    assert body["sid"] == "8809648910392"
    assert body["msisdn"] == "+8801711000101"
    assert body["sms"] == "hi"
    assert "csms_id" in body and body["csms_id"]  # a generated uuid, non-empty


async def test_post_form_style() -> None:
    response = _mock_response(200, "OK")
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=response)) as mock_post:
        await send_sms(
            api_url="https://example.com/sms-api",
            api_key="key",
            sender_id="TOPTEN",
            number="+8801711000101",
            message="hi",
            request_style=RequestStyle.POST_FORM,
        )

    _, kwargs = mock_post.call_args
    assert kwargs["data"]["api_key"] == "key"


async def test_success_field_overrides_http_2xx_on_provider_side_failure() -> None:
    """The exact bug this was built to fix: SSL Wireless returns HTTP 200
    even when the request failed, with the real result in the body."""
    body = (
        '{"status":"FAILED","status_code":4022,'
        '"error_message":"The api token field is required."}'
    )
    response = _mock_response(200, body)
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=response)):
        result = await send_sms(
            api_url="https://smsplus.sslwireless.com/api/v3/send-sms",
            api_key="",
            sender_id="TOPTEN",
            number="+8801711000101",
            message="hi",
            request_style=RequestStyle.POST_JSON,
            success_field="status_code",
            success_value="200",
        )

    assert result.success is False
    assert result.http_status == 200  # HTTP itself succeeded — the body says otherwise


async def test_success_field_configured_but_body_not_json_falls_back_to_http_status() -> None:
    response = _mock_response(200, "not json at all")
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=response)):
        result = await send_sms(
            api_url="https://example.com/sms-api",
            api_key="key",
            sender_id="TOPTEN",
            number="+8801711000101",
            message="hi",
            success_field="status_code",
            success_value="200",
        )

    assert result.success is True  # falls back to HTTP 2xx


async def test_no_success_field_configured_uses_http_status_only() -> None:
    response = _mock_response(200, '{"status":"FAILED"}')
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=response)):
        result = await send_sms(
            api_url="https://example.com/sms-api",
            api_key="key",
            sender_id="TOPTEN",
            number="+8801711000101",
            message="hi",
        )

    assert result.success is True  # no success_field configured — HTTP 200 wins


async def test_get_balance_sends_only_credentials_no_message_fields() -> None:
    response = _mock_response(200, '{"response_code":202,"balance":"1234.50"}')
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=response)) as mock_get:
        result = await get_balance(
            balance_url="https://example.com/balance",
            api_key="key",
            sender_id="TOPTEN",
            success_field="response_code",
            success_value="202",
        )

    assert result.success is True
    assert result.balance == 1234.50
    _, kwargs = mock_get.call_args
    assert kwargs["params"] == {"api_key": "key", "senderid": "TOPTEN"}


async def test_get_balance_post_json_style() -> None:
    response = _mock_response(200, '{"status":"SUCCESS","status_code":200,"balance":500}')
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=response)) as mock_post:
        result = await get_balance(
            balance_url="https://smsplus.sslwireless.com/api/v3/balance",
            api_key="token",
            sender_id="8809648910392",
            request_style=RequestStyle.POST_JSON,
            api_key_field="api_token",
            sender_id_field="sid",
            success_field="status_code",
            success_value="200",
        )

    assert result.success is True
    assert result.balance == 500
    _, kwargs = mock_post.call_args
    assert kwargs["json"] == {"api_token": "token", "sid": "8809648910392"}


async def test_get_balance_failure_never_guesses_a_zero_balance() -> None:
    response = _mock_response(
        200, '{"status":"FAILED","status_code":4001,"error_message":"Unauthorized"}'
    )
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=response)):
        result = await get_balance(
            balance_url="https://smsplus.sslwireless.com/api/v3/balance",
            api_key="bad-token",
            sender_id="8809648910392",
            request_style=RequestStyle.POST_JSON,
            api_key_field="api_token",
            sender_id_field="sid",
            success_field="status_code",
            success_value="200",
        )

    assert result.success is False
    assert result.balance is None


async def test_get_balance_success_but_unrecognized_body_returns_none_balance() -> None:
    response = _mock_response(200, '{"response_code":202}')
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=response)):
        result = await get_balance(
            balance_url="https://example.com/balance",
            api_key="key",
            sender_id="TOPTEN",
            success_field="response_code",
            success_value="202",
        )

    assert result.success is True
    assert result.balance is None
