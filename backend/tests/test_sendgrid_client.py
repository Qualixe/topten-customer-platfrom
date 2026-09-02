"""Request-building and response-parsing behavior of the SendGrid Marketing
Campaigns API client — mocks the HTTP layer so these never depend on
network access or a real SendGrid account."""

from unittest.mock import AsyncMock, patch

import httpx

from app.common.sendgrid_client import (
    create_single_send,
    find_or_create_list,
    find_or_create_suppression_group,
    find_verified_sender,
    schedule_single_send_now,
    upsert_contact,
)

API_KEY = "SG.fake-key"


def _response(status_code: int, json_body=None, text: str | None = None) -> httpx.Response:
    kwargs = {"json": json_body} if json_body is not None else {"text": text or ""}
    request = httpx.Request("GET", "https://api.sendgrid.com/v3/marketing/lists")
    return httpx.Response(status_code, request=request, **kwargs)


# --- Lists -------------------------------------------------------------------


async def test_find_or_create_list_finds_existing() -> None:
    list_response = _response(200, {"result": [{"id": "list-1", "name": "TopTen Customers"}]})
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=list_response)) as mock_get:
        result = await find_or_create_list(api_key=API_KEY, name="TopTen Customers")

    assert result.success is True
    assert result.list_id == "list-1"
    args, kwargs = mock_get.call_args
    assert args[0] == "https://api.sendgrid.com/v3/marketing/lists"
    assert kwargs["headers"]["Authorization"] == f"Bearer {API_KEY}"


async def test_find_or_create_list_creates_when_missing() -> None:
    list_response = _response(200, {"result": []})
    create_response = _response(201, {"id": "list-new", "name": "TopTen Customers"})
    with (
        patch("httpx.AsyncClient.get", new=AsyncMock(return_value=list_response)),
        patch("httpx.AsyncClient.post", new=AsyncMock(return_value=create_response)) as mock_post,
    ):
        result = await find_or_create_list(api_key=API_KEY, name="TopTen Customers")

    assert result.success is True
    assert result.list_id == "list-new"
    _, kwargs = mock_post.call_args
    assert kwargs["json"] == {"name": "TopTen Customers"}


async def test_find_or_create_list_api_error() -> None:
    error_response = _response(401, {"errors": [{"message": "Unauthorized"}]})
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=error_response)):
        result = await find_or_create_list(api_key=API_KEY, name="TopTen Customers")

    assert result.success is False
    assert "Unauthorized" in result.message


# --- Sender identity (read-only lookup — this app never creates one) -----------


async def test_find_verified_sender_matches_by_from_email() -> None:
    list_response = _response(
        200,
        [
            {"id": 5, "from": {"email": "noreply@topten.example"}, "verified": True},
            {"id": 6, "from": {"email": "someone-else@example.com"}, "verified": True},
        ],
    )
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=list_response)) as mock_get:
        result = await find_verified_sender(api_key=API_KEY, from_email="noreply@topten.example")

    assert result.success is True
    assert result.sender_id == 5
    assert result.verified is True
    args, kwargs = mock_get.call_args
    assert args[0] == "https://api.sendgrid.com/v3/senders"
    assert kwargs["headers"]["Authorization"] == f"Bearer {API_KEY}"


async def test_find_verified_sender_no_match_is_not_an_error() -> None:
    list_response = _response(200, [])
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=list_response)):
        result = await find_verified_sender(api_key=API_KEY, from_email="noreply@topten.example")

    # A clean "nothing set up yet" — the API call itself worked fine, so
    # this is not the same as an API/connection failure.
    assert result.success is True
    assert result.sender_id is None
    assert result.verified is False


async def test_find_verified_sender_reports_unverified_match() -> None:
    list_response = _response(
        200, [{"id": 7, "from": {"email": "noreply@topten.example"}, "verified": False}]
    )
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=list_response)):
        result = await find_verified_sender(api_key=API_KEY, from_email="noreply@topten.example")

    assert result.success is True
    assert result.sender_id == 7
    assert result.verified is False


async def test_find_verified_sender_api_error() -> None:
    error_response = _response(401, {"errors": [{"message": "Unauthorized"}]})
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=error_response)):
        result = await find_verified_sender(api_key=API_KEY, from_email="noreply@topten.example")

    assert result.success is False
    assert "Unauthorized" in result.message


# --- Suppression group ---------------------------------------------------------


async def test_find_or_create_suppression_group_creates_when_missing() -> None:
    list_response = _response(200, [])
    create_response = _response(201, {"id": 42, "name": "TopTen Marketing"})
    with (
        patch("httpx.AsyncClient.get", new=AsyncMock(return_value=list_response)),
        patch("httpx.AsyncClient.post", new=AsyncMock(return_value=create_response)),
    ):
        result = await find_or_create_suppression_group(
            api_key=API_KEY, name="TopTen Marketing", description="Unsubscribe group"
        )

    assert result.success is True
    assert result.group_id == 42


# --- Contact upsert (async job polling) -----------------------------------------


async def test_upsert_contact_success_on_first_poll() -> None:
    submit_response = _response(202, {"job_id": "job-1"})
    status_response = _response(
        200, {"status": "completed", "results": {"errored_count": 0}}
    )
    with (
        patch("httpx.AsyncClient.put", new=AsyncMock(return_value=submit_response)),
        patch("httpx.AsyncClient.get", new=AsyncMock(return_value=status_response)),
    ):
        result = await upsert_contact(
            api_key=API_KEY,
            list_id="list-1",
            email="rahim@example.com",
            first_name="Rahim",
            phone="+8801711000101",
            poll_interval_seconds=0,
            max_poll_attempts=3,
        )

    assert result.success is True
    assert result.job_id == "job-1"


async def test_upsert_contact_errored_count_is_a_failure() -> None:
    submit_response = _response(202, {"job_id": "job-2"})
    status_response = _response(
        200, {"status": "completed", "results": {"errored_count": 1}}
    )
    with (
        patch("httpx.AsyncClient.put", new=AsyncMock(return_value=submit_response)),
        patch("httpx.AsyncClient.get", new=AsyncMock(return_value=status_response)),
    ):
        result = await upsert_contact(
            api_key=API_KEY,
            list_id="list-1",
            email="bad@invalid",
            first_name=None,
            phone=None,
            poll_interval_seconds=0,
            max_poll_attempts=3,
        )

    assert result.success is False


async def test_upsert_contact_timeout_reports_still_processing() -> None:
    submit_response = _response(202, {"job_id": "job-3"})
    still_pending_response = _response(200, {"status": "pending"})
    with (
        patch("httpx.AsyncClient.put", new=AsyncMock(return_value=submit_response)),
        patch("httpx.AsyncClient.get", new=AsyncMock(return_value=still_pending_response)),
    ):
        result = await upsert_contact(
            api_key=API_KEY,
            list_id="list-1",
            email="rahim@example.com",
            first_name="Rahim",
            phone=None,
            poll_interval_seconds=0,
            max_poll_attempts=3,
        )

    assert result.success is False
    assert "still processing" in result.message.lower()


async def test_upsert_contact_submit_rejected() -> None:
    submit_response = _response(400, {"errors": [{"message": "Invalid email"}]})
    with patch("httpx.AsyncClient.put", new=AsyncMock(return_value=submit_response)):
        result = await upsert_contact(
            api_key=API_KEY,
            list_id="list-1",
            email="not-an-email",
            first_name=None,
            phone=None,
        )

    assert result.success is False
    assert "Invalid email" in result.message


# --- Single Send (campaign) ------------------------------------------------------


async def test_create_single_send_success() -> None:
    response = _response(201, {"id": "campaign-1", "status": "draft"})
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=response)) as mock_post:
        result = await create_single_send(
            api_key=API_KEY,
            list_id="list-1",
            sender_id=5,
            suppression_group_id=42,
            name="Promo",
            subject="Hello",
            html="<p>Hi</p>",
        )

    assert result.success is True
    assert result.campaign_id == "campaign-1"
    _, kwargs = mock_post.call_args
    assert kwargs["json"]["email_config"]["html_content"] == "<p>Hi</p>"
    assert kwargs["json"]["email_config"]["sender_id"] == 5
    assert kwargs["json"]["email_config"]["suppression_group_id"] == 42


async def test_schedule_single_send_now_success() -> None:
    response = _response(200, {"send_at": "now", "status": "Scheduled"})
    with patch("httpx.AsyncClient.put", new=AsyncMock(return_value=response)) as mock_put:
        result = await schedule_single_send_now(api_key=API_KEY, campaign_id="campaign-1")

    assert result.success is True
    _, kwargs = mock_put.call_args
    assert kwargs["json"] == {"send_at": "now"}


async def test_schedule_single_send_now_failure() -> None:
    response = _response(400, {"errors": [{"message": "Sender identity not verified"}]})
    with patch("httpx.AsyncClient.put", new=AsyncMock(return_value=response)):
        result = await schedule_single_send_now(api_key=API_KEY, campaign_id="campaign-1")

    assert result.success is False
    assert "not verified" in result.message


async def test_malformed_response_is_a_failure() -> None:
    response = _response(502, None, text="Bad Gateway")
    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=response)):
        result = await find_or_create_list(api_key=API_KEY, name="TopTen Customers")

    assert result.success is False
    assert "Bad Gateway" in result.message
