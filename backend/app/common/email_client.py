"""Mailchimp Transactional (Mandrill) API client for outbound email.

One API key, one POST per email — https://mailchimp.com/developer/transactional/api/messages/send-new-message/.
The API is still branded/hosted under the legacy "Mandrill" name
(mandrillapp.com) even though the product is now called Mailchimp
Transactional Email; that's not a typo below.
"""

from dataclasses import dataclass

import httpx

MANDRILL_API_BASE = "https://mandrillapp.com/api/1.0"


@dataclass(frozen=True, slots=True)
class SendEmailResult:
    success: bool
    message: str


def _response_message(response: httpx.Response) -> str:
    text = response.text.strip()
    return text[:500] if text else f"HTTP {response.status_code}, empty response body"


async def send_email(
    *,
    api_key: str,
    from_address: str,
    from_name: str | None,
    to_address: str,
    subject: str,
    body: str,
) -> SendEmailResult:
    """Sends one email via Mailchimp Transactional. Never raises for an
    API-level rejection (invalid key, unverified sender, bounced/rejected
    recipient, ...) — that's reported through `SendEmailResult.success`/
    `message`, same contract as `sms_gateway_client.send_sms`. Only a
    genuine connection failure (unreachable host, timeout) raises
    `httpx.HTTPError`."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"{MANDRILL_API_BASE}/messages/send.json",
            json={
                "key": api_key,
                "message": {
                    "text": body,
                    "subject": subject,
                    "from_email": from_address,
                    "from_name": from_name,
                    "to": [{"email": to_address, "type": "to"}],
                },
            },
        )

    try:
        payload = response.json()
    except ValueError:
        return SendEmailResult(success=False, message=_response_message(response))

    # An API-level error (bad key, malformed request, ...) comes back as a
    # single object: {"status": "error", "code": ..., "name": ..., "message": "..."}.
    if isinstance(payload, dict):
        return SendEmailResult(
            success=False, message=str(payload.get("message") or payload)[:500]
        )

    # A normal send comes back as a list, one result per "to" recipient —
    # always exactly one here, since one call always sends to one address.
    if isinstance(payload, list) and payload:
        result = payload[0]
        status = result.get("status")
        if status in ("sent", "queued", "scheduled"):
            return SendEmailResult(success=True, message=status)
        reason = result.get("reject_reason") or status or "Unknown failure"
        return SendEmailResult(success=False, message=str(reason)[:500])

    return SendEmailResult(success=False, message=_response_message(response))
