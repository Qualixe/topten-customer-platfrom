"""SendGrid Marketing Campaigns API client — Lists, Contacts, Sender
Identities, Suppression (unsubscribe) Groups, and Single Sends (SendGrid's
name for a marketing campaign). https://www.twilio.com/docs/sendgrid/api-reference.

Every function returns a small result dataclass with `success`/`message`
(and whatever id the operation produced) rather than raising on an
API-level rejection — same never-raise-on-API-error contract as
app.common.sms_gateway_client.send_sms. Only a genuine connection failure
(unreachable host, timeout) raises `httpx.HTTPError`.

Contact upserts are asynchronous on SendGrid's side (`PUT
/v3/marketing/contacts` returns a job id, not an immediate result) — see
`upsert_contact`'s docstring for how that's reconciled with this app's
synchronous per-customer success/failure reporting.
"""

import asyncio
from dataclasses import dataclass

import httpx

SENDGRID_API_BASE = "https://api.sendgrid.com/v3"
SENDGRID_API_TIMEOUT = 15.0

# How long upsert_contact waits for SendGrid's async import job to finish
# before giving up and reporting "still processing" — small jobs (this
# client only ever submits one contact per job) normally complete in a
# couple of seconds, so this is generous without risking a long hang.
_IMPORT_POLL_INTERVAL_SECONDS = 1.0
_IMPORT_POLL_MAX_ATTEMPTS = 15


def _auth_header(api_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}"}


def _error_message(response: httpx.Response) -> str:
    """SendGrid error responses are `{"errors": [{"message": ..., "field": ...}]}`.
    Falls back to the raw body for a non-JSON/unexpected error shape (e.g.
    an upstream gateway error page)."""
    try:
        payload = response.json()
    except ValueError:
        text = response.text.strip()
        return text[:500] if text else f"HTTP {response.status_code}, empty response body"
    if isinstance(payload, dict):
        errors = payload.get("errors")
        if isinstance(errors, list) and errors:
            first = errors[0]
            message = first.get("message") if isinstance(first, dict) else None
            if message:
                return str(message)[:500]
    return str(payload)[:500]


@dataclass(frozen=True, slots=True)
class ListResult:
    success: bool
    message: str
    list_id: str | None = None


@dataclass(frozen=True, slots=True)
class SenderResult:
    success: bool
    message: str
    sender_id: int | None = None
    verified: bool = False


@dataclass(frozen=True, slots=True)
class SuppressionResult:
    success: bool
    message: str
    group_id: int | None = None


@dataclass(frozen=True, slots=True)
class UpsertResult:
    success: bool
    message: str
    job_id: str | None = None


@dataclass(frozen=True, slots=True)
class CampaignResult:
    success: bool
    message: str
    campaign_id: str | None = None


@dataclass(frozen=True, slots=True)
class ActionResult:
    success: bool
    message: str = ""


async def find_or_create_list(*, api_key: str, name: str) -> ListResult:
    async with httpx.AsyncClient(timeout=SENDGRID_API_TIMEOUT) as client:
        list_response = await client.get(
            f"{SENDGRID_API_BASE}/marketing/lists", headers=_auth_header(api_key)
        )
        if list_response.status_code >= 400:
            return ListResult(success=False, message=_error_message(list_response))

        for existing in list_response.json().get("result", []):
            if existing.get("name") == name:
                return ListResult(success=True, message="found", list_id=existing["id"])

        create_response = await client.post(
            f"{SENDGRID_API_BASE}/marketing/lists",
            headers=_auth_header(api_key),
            json={"name": name},
        )
    if create_response.status_code >= 400:
        return ListResult(success=False, message=_error_message(create_response))
    return ListResult(success=True, message="created", list_id=create_response.json()["id"])


async def find_verified_sender(*, api_key: str, from_email: str) -> SenderResult:
    """Sender/domain verification is treated as an external SendGrid-side
    setup step — this app never creates a Sender Identity via the API
    (that call requires a physical mailing address and nickname, which
    this app deliberately doesn't collect; see the credentials form).
    Instead, the admin verifies a sender or authenticates a domain
    directly in SendGrid's dashboard, and this just looks up whichever
    existing Sender Identity matches the configured `from_email`.

    `success=False` only for a genuine API/connection failure. A clean
    "no matching sender" is `success=True, sender_id=None, verified=False`
    — the caller distinguishes "SendGrid is unreachable" from "nothing is
    set up yet" and reports each differently."""
    async with httpx.AsyncClient(timeout=SENDGRID_API_TIMEOUT) as client:
        response = await client.get(f"{SENDGRID_API_BASE}/senders", headers=_auth_header(api_key))
    if response.status_code >= 400:
        return SenderResult(success=False, message=_error_message(response))

    for existing in response.json():
        sender_from = existing.get("from") or {}
        if sender_from.get("email") == from_email:
            return SenderResult(
                success=True,
                message="found",
                sender_id=existing["id"],
                verified=bool(existing.get("verified")),
            )
    return SenderResult(success=True, message="not found", sender_id=None, verified=False)


async def find_or_create_suppression_group(
    *, api_key: str, name: str, description: str
) -> SuppressionResult:
    async with httpx.AsyncClient(timeout=SENDGRID_API_TIMEOUT) as client:
        list_response = await client.get(
            f"{SENDGRID_API_BASE}/asm/groups", headers=_auth_header(api_key)
        )
        if list_response.status_code >= 400:
            return SuppressionResult(success=False, message=_error_message(list_response))

        for existing in list_response.json():
            if existing.get("name") == name:
                return SuppressionResult(success=True, message="found", group_id=existing["id"])

        create_response = await client.post(
            f"{SENDGRID_API_BASE}/asm/groups",
            headers=_auth_header(api_key),
            json={"name": name, "description": description, "is_default": False},
        )
    if create_response.status_code >= 400:
        return SuppressionResult(success=False, message=_error_message(create_response))
    return SuppressionResult(
        success=True, message="created", group_id=create_response.json()["id"]
    )


async def upsert_contact(
    *,
    api_key: str,
    list_id: str,
    email: str,
    first_name: str | None,
    phone: str | None,
    poll_interval_seconds: float = _IMPORT_POLL_INTERVAL_SECONDS,
    max_poll_attempts: int = _IMPORT_POLL_MAX_ATTEMPTS,
) -> UpsertResult:
    """Create-or-update by email — SendGrid's own dedupe key. Submits a
    single-contact import job and polls it to completion (or a bounded
    timeout) so the caller gets a real success/failure the same way the
    old (synchronous) Mailchimp client did, rather than reporting
    "submitted" and being wrong half the time. A poll that times out
    reports failure with a "still processing" message rather than
    claiming success it can't confirm, and rather than blocking forever.
    `poll_interval_seconds`/`max_poll_attempts` are only ever overridden by
    tests, to avoid a real wall-clock wait against mocked responses."""
    custom_fields: dict[str, str] = {}
    if phone:
        custom_fields["phone"] = phone

    async with httpx.AsyncClient(timeout=SENDGRID_API_TIMEOUT) as client:
        submit_response = await client.put(
            f"{SENDGRID_API_BASE}/marketing/contacts",
            headers=_auth_header(api_key),
            json={
                "list_ids": [list_id],
                "contacts": [
                    {
                        "email": email,
                        "first_name": first_name or "",
                        "custom_fields": custom_fields,
                    }
                ],
            },
        )
        if submit_response.status_code >= 400:
            return UpsertResult(success=False, message=_error_message(submit_response))
        job_id = submit_response.json().get("job_id")
        if not job_id:
            return UpsertResult(success=False, message="SendGrid did not return a job id")

        for _ in range(max_poll_attempts):
            await asyncio.sleep(poll_interval_seconds)
            status_response = await client.get(
                f"{SENDGRID_API_BASE}/marketing/contacts/imports/{job_id}",
                headers=_auth_header(api_key),
            )
            if status_response.status_code >= 400:
                return UpsertResult(
                    success=False, message=_error_message(status_response), job_id=job_id
                )
            body = status_response.json()
            if body.get("status") == "completed":
                errored = (body.get("results") or {}).get("errored_count", 0)
                if errored:
                    return UpsertResult(
                        success=False,
                        message="SendGrid rejected this contact — see the account's import "
                        "history for detail",
                        job_id=job_id,
                    )
                return UpsertResult(success=True, message="synced", job_id=job_id)
            if body.get("status") in ("failed", "errored"):
                return UpsertResult(
                    success=False, message=f"Import {body['status']}", job_id=job_id
                )

    return UpsertResult(
        success=False, message="Still processing — check back shortly", job_id=job_id
    )


async def create_single_send(
    *,
    api_key: str,
    list_id: str,
    sender_id: int,
    suppression_group_id: int,
    name: str,
    subject: str,
    html: str,
) -> CampaignResult:
    """Creates the campaign as a draft with its content fully set — unlike
    Mailchimp, SendGrid has no separate "set content" call."""
    async with httpx.AsyncClient(timeout=SENDGRID_API_TIMEOUT) as client:
        response = await client.post(
            f"{SENDGRID_API_BASE}/marketing/singlesends",
            headers=_auth_header(api_key),
            json={
                "name": name,
                "send_to": {"list_ids": [list_id]},
                "email_config": {
                    "subject": subject,
                    "html_content": html,
                    "sender_id": sender_id,
                    "suppression_group_id": suppression_group_id,
                },
            },
        )
    if response.status_code >= 400:
        return CampaignResult(success=False, message=_error_message(response))
    return CampaignResult(success=True, message="created", campaign_id=response.json()["id"])


async def schedule_single_send_now(*, api_key: str, campaign_id: str) -> ActionResult:
    async with httpx.AsyncClient(timeout=SENDGRID_API_TIMEOUT) as client:
        response = await client.put(
            f"{SENDGRID_API_BASE}/marketing/singlesends/{campaign_id}/schedule",
            headers=_auth_header(api_key),
            json={"send_at": "now"},
        )
    if response.status_code >= 400:
        return ActionResult(success=False, message=_error_message(response))
    return ActionResult(success=True, message="sent")
