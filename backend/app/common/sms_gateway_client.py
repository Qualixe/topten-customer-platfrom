"""Generic, fully-configurable HTTP client for a user-configured SMS
gateway.

Deliberately not tied to any single provider's contract. Two things vary
enough between real gateways (confirmed by actually integrating two very
different ones — bulksmsbd.net's GET+query-string API and SSL Wireless SMS
Plus's POST+JSON API with entirely different field names) that they must be
configurable rather than assumed:

1. **Request shape** — `RequestStyle` picks GET-with-query-string,
   POST-with-JSON-body, or POST-with-form-body.
2. **Field names** — the admin maps this client's four logical fields
   (api key, sender id, phone number, message) onto whatever key names
   their provider expects (e.g. `api_key`/`senderid`/`number`/`message` for
   bulksmsbd.net vs `api_token`/`sid`/`msisdn`/`sms` for SSL Wireless). An
   optional fifth field (`request_id_field`) covers providers that require
   a caller-generated correlation id per request (e.g. SSL Wireless's
   `csms_id`) — a fresh uuid4 is generated per send when configured.

**Success detection** is the other thing that isn't actually universal:
many of these gateways return HTTP 200 even on failure, encoding the real
result in the JSON body instead (confirmed against SSL Wireless, which
returns 200 with `{"status":"FAILED",...}` for a bad api_token). When the
admin configures `success_field`/`success_value`, this client checks
`str(json_body[success_field]) == success_value` and trusts that over HTTP
status. Without that configured, it falls back to "HTTP 2xx" — the one
thing that actually is universal, but not sufficient on its own for many of
these providers.
"""

import uuid
from dataclasses import dataclass
from enum import Enum

import httpx


class RequestStyle(str, Enum):
    GET_QUERY = "GET_QUERY"
    POST_JSON = "POST_JSON"
    POST_FORM = "POST_FORM"


@dataclass(frozen=True, slots=True)
class SendSmsResult:
    success: bool
    http_status: int
    message: str


def _response_message(response: httpx.Response) -> str:
    text = response.text.strip()
    return text[:500] if text else f"HTTP {response.status_code}, empty response body"


def _judge_success(
    response: httpx.Response, success_field: str | None, success_value: str | None
) -> bool:
    """Prefers a body-field check over raw HTTP status when the admin has
    configured one — see module docstring for why HTTP status alone isn't
    trustworthy for these providers. Falls back to HTTP status if the body
    isn't JSON, doesn't have the field, or no field/value was configured."""
    if success_field and success_value:
        try:
            body = response.json()
        except ValueError:
            body = None
        if isinstance(body, dict) and success_field in body:
            return str(body[success_field]) == success_value
    return response.is_success


async def send_sms(
    *,
    api_url: str,
    api_key: str,
    sender_id: str,
    number: str,
    message: str,
    request_style: RequestStyle = RequestStyle.GET_QUERY,
    api_key_field: str = "api_key",
    sender_id_field: str = "senderid",
    number_field: str = "number",
    message_field: str = "message",
    request_id_field: str | None = None,
    success_field: str | None = None,
    success_value: str | None = None,
) -> SendSmsResult:
    """Sends one SMS via the configured gateway. Never raises for a
    provider-side failure (bad key, insufficient balance, malformed
    request, ...) — that's reported through `SendSmsResult.success`/
    `message`. Only a genuine network/transport failure (unreachable host,
    timeout, invalid URL) raises `httpx.HTTPError`."""
    fields: dict[str, str] = {
        api_key_field: api_key,
        sender_id_field: sender_id,
        number_field: number,
        message_field: message,
    }
    if request_id_field:
        fields[request_id_field] = str(uuid.uuid4())

    async with httpx.AsyncClient(timeout=15.0) as client:
        if request_style == RequestStyle.POST_JSON:
            response = await client.post(api_url, json=fields)
        elif request_style == RequestStyle.POST_FORM:
            response = await client.post(api_url, data=fields)
        else:
            response = await client.get(api_url, params=fields)

    return SendSmsResult(
        success=_judge_success(response, success_field, success_value),
        http_status=response.status_code,
        message=_response_message(response),
    )
