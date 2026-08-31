"""Request-building and response-parsing behavior of the Mailchimp
Transactional (Mandrill) client — mocks the HTTP layer so these never
depend on network access or a real Mailchimp account."""

from unittest.mock import AsyncMock, patch

import httpx

from app.common.email_client import send_email


def _mock_response(status_code: int, text: str) -> httpx.Response:
    return httpx.Response(
        status_code,
        text=text,
        request=httpx.Request("POST", "https://mandrillapp.com/api/1.0/messages/send.json"),
    )


async def test_send_success_on_sent_status() -> None:
    response = _mock_response(200, '[{"email":"a@example.com","status":"sent","_id":"abc"}]')
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=response)) as mock_post:
        result = await send_email(
            api_key="key",
            from_address="noreply@example.com",
            from_name="TopTen",
            to_address="a@example.com",
            subject="Hi",
            body="Hello there",
        )

    assert result.success is True
    assert result.message == "sent"
    args, kwargs = mock_post.call_args
    assert args[0] == "https://mandrillapp.com/api/1.0/messages/send.json"
    assert kwargs["json"]["key"] == "key"
    assert kwargs["json"]["message"] == {
        "text": "Hello there",
        "subject": "Hi",
        "from_email": "noreply@example.com",
        "from_name": "TopTen",
        "to": [{"email": "a@example.com", "type": "to"}],
    }


async def test_send_success_on_queued_status() -> None:
    response = _mock_response(200, '[{"email":"a@example.com","status":"queued"}]')
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=response)):
        result = await send_email(
            api_key="key",
            from_address="noreply@example.com",
            from_name=None,
            to_address="a@example.com",
            subject="Hi",
            body="Hello",
        )

    assert result.success is True


async def test_rejected_recipient_is_a_failure() -> None:
    response = _mock_response(
        200,
        '[{"email":"a@example.com","status":"rejected","reject_reason":"invalid-sender"}]',
    )
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=response)):
        result = await send_email(
            api_key="key",
            from_address="noreply@example.com",
            from_name=None,
            to_address="a@example.com",
            subject="Hi",
            body="Hello",
        )

    assert result.success is False
    assert result.message == "invalid-sender"


async def test_api_error_is_a_failure() -> None:
    # A malformed request or bad key comes back as a single object, not a list.
    response = _mock_response(
        500, '{"status":"error","code":-1,"name":"Invalid_Key","message":"Invalid API key"}'
    )
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=response)):
        result = await send_email(
            api_key="bad-key",
            from_address="noreply@example.com",
            from_name=None,
            to_address="a@example.com",
            subject="Hi",
            body="Hello",
        )

    assert result.success is False
    assert result.message == "Invalid API key"


async def test_non_json_response_is_a_failure() -> None:
    response = _mock_response(502, "Bad Gateway")
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=response)):
        result = await send_email(
            api_key="key",
            from_address="noreply@example.com",
            from_name=None,
            to_address="a@example.com",
            subject="Hi",
            body="Hello",
        )

    assert result.success is False
    assert "Bad Gateway" in result.message
