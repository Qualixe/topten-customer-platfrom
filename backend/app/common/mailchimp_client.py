"""Mailchimp Marketing API client — Audiences (Lists) and List Members.
https://mailchimp.com/developer/marketing/api/.

Every function returns a small result dataclass with `success`/`message`
rather than raising on an API-level rejection — same never-raise-on-API-error
contract as app.common.sendgrid_client. Only a genuine connection failure
(unreachable host, timeout) raises `httpx.HTTPError`.

Mailchimp API keys are shaped `<key>-<datacenter>` (e.g. `abc123-us21`) —
the datacenter suffix picks which regional API host to call, so it's parsed
from the key itself rather than being a separate setting.

Unlike SendGrid's async contact-import job, Mailchimp's member upsert
(`PUT /lists/{id}/members/{hash}`) is synchronous — no polling needed.
"""

import hashlib
from dataclasses import dataclass

import httpx

MAILCHIMP_API_TIMEOUT = 15.0


def _datacenter(api_key: str) -> str | None:
    if "-" not in api_key:
        return None
    return api_key.rsplit("-", 1)[1] or None


def _base_url(api_key: str) -> str | None:
    datacenter = _datacenter(api_key)
    if not datacenter:
        return None
    return f"https://{datacenter}.api.mailchimp.com/3.0"


def _auth(api_key: str) -> httpx.BasicAuth:
    # Mailchimp accepts any non-empty username with the API key as the
    # password — "anystring" is the value used in Mailchimp's own docs.
    return httpx.BasicAuth("anystring", api_key)


def _subscriber_hash(email: str) -> str:
    return hashlib.md5(email.strip().lower().encode("utf-8")).hexdigest()


def _error_message(response: httpx.Response) -> str:
    """Mailchimp error responses are RFC 7807-shaped:
    `{"type": ..., "title": ..., "status": ..., "detail": ...}`. Falls back
    to the raw body for a non-JSON/unexpected error shape."""
    try:
        payload = response.json()
    except ValueError:
        text = response.text.strip()
        return text[:500] if text else f"HTTP {response.status_code}, empty response body"
    if isinstance(payload, dict):
        detail = payload.get("detail") or payload.get("title")
        if detail:
            return str(detail)[:500]
    return str(payload)[:500]


@dataclass(frozen=True, slots=True)
class PingResult:
    success: bool
    message: str


@dataclass(frozen=True, slots=True)
class ListResult:
    success: bool
    message: str
    list_id: str | None = None
    list_name: str | None = None


@dataclass(frozen=True, slots=True)
class UpsertResult:
    success: bool
    message: str


async def verify_api_key(*, api_key: str) -> PingResult:
    """A cheap, side-effect-free call to confirm the key (and its embedded
    datacenter) actually authenticates."""
    base_url = _base_url(api_key)
    if base_url is None:
        return PingResult(
            success=False,
            message="Invalid API key format — expected a value ending in -xxNN (e.g. -us21).",
        )
    async with httpx.AsyncClient(timeout=MAILCHIMP_API_TIMEOUT) as client:
        response = await client.get(f"{base_url}/ping", auth=_auth(api_key))
    if response.status_code >= 400:
        return PingResult(success=False, message=_error_message(response))
    return PingResult(success=True, message="ok")


async def verify_list(*, api_key: str, list_id: str) -> ListResult:
    """Confirms `list_id` (the Audience ID, found in Mailchimp under
    Audience → Settings → Audience name and defaults) exists and is
    reachable with this key. This app never creates an Audience via the
    API — Mailchimp requires a full contact/compliance block (company,
    address, permission reminder) to do that, which this app doesn't
    collect — so the admin creates the Audience in Mailchimp directly and
    pastes its id here."""
    base_url = _base_url(api_key)
    if base_url is None:
        return ListResult(
            success=False,
            message="Invalid API key format — expected a value ending in -xxNN (e.g. -us21).",
        )
    async with httpx.AsyncClient(timeout=MAILCHIMP_API_TIMEOUT) as client:
        response = await client.get(f"{base_url}/lists/{list_id}", auth=_auth(api_key))
    if response.status_code >= 400:
        return ListResult(success=False, message=_error_message(response))
    body = response.json()
    return ListResult(success=True, message="found", list_id=list_id, list_name=body.get("name"))


async def upsert_member(
    *,
    api_key: str,
    list_id: str,
    email: str,
    first_name: str | None,
    phone: str | None,
) -> UpsertResult:
    """Create-or-update by email (via its MD5 hash, Mailchimp's own dedupe
    key). `status_if_new="subscribed"` is safe here — this is only ever
    called for customers who've already opted in (see
    app.services.mailchimp_sync.sync_customers's eligibility filter)."""
    base_url = _base_url(api_key)
    if base_url is None:
        return UpsertResult(
            success=False,
            message="Invalid API key format — expected a value ending in -xxNN (e.g. -us21).",
        )
    merge_fields: dict[str, str] = {}
    if first_name:
        merge_fields["FNAME"] = first_name
    if phone:
        merge_fields["PHONE"] = phone

    async with httpx.AsyncClient(timeout=MAILCHIMP_API_TIMEOUT) as client:
        response = await client.put(
            f"{base_url}/lists/{list_id}/members/{_subscriber_hash(email)}",
            auth=_auth(api_key),
            json={
                "email_address": email,
                "status_if_new": "subscribed",
                "merge_fields": merge_fields,
            },
        )
    if response.status_code >= 400:
        return UpsertResult(success=False, message=_error_message(response))
    return UpsertResult(success=True, message="synced")
