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


@dataclass(frozen=True, slots=True)
class BalanceResult:
    success: bool
    http_status: int
    message: str
    # None unless `success` is true and a balance field was actually found
    # in the response body — the field name isn't configurable (unlike the
    # send-SMS fields) since it's only used to *display* a number, never to
    # build a request, so a few likely names are tried instead. Never a
    # guessed zero, since that would read as a real (and alarming) balance.
    balance: float | None


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


async def _send_request(
    url: str,
    fields: dict[str, str],
    request_style: RequestStyle,
) -> httpx.Response:
    async with httpx.AsyncClient(timeout=15.0) as client:
        if request_style == RequestStyle.POST_JSON:
            return await client.post(url, json=fields)
        if request_style == RequestStyle.POST_FORM:
            return await client.post(url, data=fields)
        return await client.get(url, params=fields)


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

    response = await _send_request(api_url, fields, request_style)

    return SendSmsResult(
        success=_judge_success(response, success_field, success_value),
        http_status=response.status_code,
        message=_response_message(response),
    )


_BALANCE_FIELD_CANDIDATES = ("balance", "current_balance", "sms_balance", "credit")


def _extract_balance(response: httpx.Response) -> float | None:
    try:
        body = response.json()
    except ValueError:
        return None
    if not isinstance(body, dict):
        return None
    for key in _BALANCE_FIELD_CANDIDATES:
        if key in body:
            try:
                return float(body[key])
            except (TypeError, ValueError):
                continue
    return None


async def get_balance(
    *,
    balance_url: str,
    api_key: str,
    sender_id: str,
    request_style: RequestStyle = RequestStyle.GET_QUERY,
    api_key_field: str = "api_key",
    sender_id_field: str = "senderid",
    success_field: str | None = None,
    success_value: str | None = None,
) -> BalanceResult:
    """Fetches the account balance from a separate, provider-specific
    balance endpoint. Reuses `request_style` and the api key/sender id
    field names from the send-SMS config, since every provider integrated
    so far uses the same request shape and credentials for both — only the
    URL differs. Never raises for a provider-side failure; only a genuine
    network/transport failure does. The field carrying the balance number
    itself isn't documented for any of these providers, so it's guessed
    from a few likely names — `balance` comes back `None` even on an
    otherwise-successful call if none match."""
    fields: dict[str, str] = {api_key_field: api_key, sender_id_field: sender_id}
    response = await _send_request(balance_url, fields, request_style)
    success = _judge_success(response, success_field, success_value)

    return BalanceResult(
        success=success,
        http_status=response.status_code,
        message=_response_message(response),
        balance=_extract_balance(response) if success else None,
    )
