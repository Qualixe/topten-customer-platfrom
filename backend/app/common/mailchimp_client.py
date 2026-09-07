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


@dataclass(frozen=True, slots=True)
class TemplateSummary:
    id: int
    name: str
    thumbnail: str | None


@dataclass(frozen=True, slots=True)
class TemplatesResult:
    success: bool
    message: str
    templates: tuple[TemplateSummary, ...] = ()


@dataclass(frozen=True, slots=True)
class TemplateContentResult:
    success: bool
    message: str
    # section name -> its default HTML content, as authored in the
    # template's own `mc:edit="..."` regions.
    sections: dict[str, str] | None = None


@dataclass(frozen=True, slots=True)
class SegmentResult:
    success: bool
    message: str
    segment_id: int | None = None


@dataclass(frozen=True, slots=True)
class CampaignResult:
    success: bool
    message: str
    campaign_id: str | None = None
    web_id: int | None = None


@dataclass(frozen=True, slots=True)
class ActionResult:
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


_TEMPLATES_PAGE_SIZE = 100


async def list_templates(*, api_key: str) -> TemplatesResult:
    """The account's saved templates — designed visually in Mailchimp's own
    editor, each with zero or more named `mc:edit="..."` editable regions
    (see `get_template_default_content`). Not filtered by `type` — includes
    the account's own custom (`user`) templates alongside Mailchimp's stock
    `base`/`gallery` ones, since either is a valid pick."""
    base_url = _base_url(api_key)
    if base_url is None:
        return TemplatesResult(
            success=False,
            message="Invalid API key format — expected a value ending in -xxNN (e.g. -us21).",
        )
    async with httpx.AsyncClient(timeout=MAILCHIMP_API_TIMEOUT) as client:
        response = await client.get(
            f"{base_url}/templates",
            auth=_auth(api_key),
            params={"count": _TEMPLATES_PAGE_SIZE, "sort_field": "name", "sort_dir": "ASC"},
        )
    if response.status_code >= 400:
        return TemplatesResult(success=False, message=_error_message(response))
    body = response.json()
    templates = tuple(
        TemplateSummary(id=item["id"], name=item["name"], thumbnail=item.get("thumbnail") or None)
        for item in body.get("templates", [])
    )
    return TemplatesResult(success=True, message="ok", templates=templates)


async def get_template_default_content(*, api_key: str, template_id: int) -> TemplateContentResult:
    """The template's editable section names and their default/starting
    content — what to show the admin to fill in before attaching this
    template to a campaign (see `set_campaign_template_content`)."""
    base_url = _base_url(api_key)
    if base_url is None:
        return TemplateContentResult(
            success=False,
            message="Invalid API key format — expected a value ending in -xxNN (e.g. -us21).",
        )
    async with httpx.AsyncClient(timeout=MAILCHIMP_API_TIMEOUT) as client:
        response = await client.get(
            f"{base_url}/templates/{template_id}/default-content", auth=_auth(api_key)
        )
    if response.status_code >= 400:
        return TemplateContentResult(success=False, message=_error_message(response))
    body = response.json()
    return TemplateContentResult(success=True, message="ok", sections=body.get("sections", {}))


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


async def create_static_segment(
    *, api_key: str, list_id: str, name: str, emails: list[str]
) -> SegmentResult:
    """Creates a one-off static segment scoped to exactly `emails` — the
    Mailchimp equivalent of a per-campaign recipient list. Every address
    must already be a list member (see `upsert_member`) before it can be
    added to a segment."""
    base_url = _base_url(api_key)
    if base_url is None:
        return SegmentResult(
            success=False,
            message="Invalid API key format — expected a value ending in -xxNN (e.g. -us21).",
        )
    async with httpx.AsyncClient(timeout=MAILCHIMP_API_TIMEOUT) as client:
        response = await client.post(
            f"{base_url}/lists/{list_id}/segments",
            auth=_auth(api_key),
            json={"name": name, "static_segment": emails},
        )
    if response.status_code >= 400:
        return SegmentResult(success=False, message=_error_message(response))
    body = response.json()
    return SegmentResult(success=True, message="created", segment_id=body.get("id"))


async def create_campaign(
    *,
    api_key: str,
    list_id: str,
    segment_id: int | None,
    subject: str,
    from_name: str,
    reply_to: str,
    template_id: int | None = None,
) -> CampaignResult:
    """Creates a "regular" campaign as a draft, targeted at the given
    static segment — or, with `segment_id=None`, at the whole Audience.
    The latter is only ever safe for a campaign nothing will call
    `send_campaign` on (see `send_test_campaign`): a Mailchimp "test send"
    goes only to the addresses passed to `send_test_email`, never to
    anyone actually in the targeted list/segment, so an unscoped test
    campaign can't leak to real subscribers. `from_name`/`reply_to` are
    this app's configured campaign defaults (see Settings) — the actual
    from-email address comes from the Audience's own Campaign Defaults,
    configured in Mailchimp directly, same as the Audience itself (see
    `verify_list`). `template_id` (see `list_templates`) attaches one of
    the account's saved Mailchimp templates — pair with
    `set_campaign_template_content` (not `set_campaign_content`) to fill
    in just its named editable section(s) rather than replacing the whole
    design with raw HTML."""
    base_url = _base_url(api_key)
    if base_url is None:
        return CampaignResult(
            success=False,
            message="Invalid API key format — expected a value ending in -xxNN (e.g. -us21).",
        )
    recipients: dict = {"list_id": list_id}
    if segment_id is not None:
        recipients["segment_opts"] = {"saved_segment_id": segment_id}
    settings: dict = {
        "subject_line": subject,
        "title": subject,
        "from_name": from_name,
        "reply_to": reply_to,
    }
    if template_id is not None:
        settings["template_id"] = template_id
    async with httpx.AsyncClient(timeout=MAILCHIMP_API_TIMEOUT) as client:
        response = await client.post(
            f"{base_url}/campaigns",
            auth=_auth(api_key),
            json={"type": "regular", "recipients": recipients, "settings": settings},
        )
    if response.status_code >= 400:
        return CampaignResult(success=False, message=_error_message(response))
    body = response.json()
    return CampaignResult(
        success=True, message="created", campaign_id=body.get("id"), web_id=body.get("web_id")
    )


async def set_campaign_content(*, api_key: str, campaign_id: str, html: str) -> ActionResult:
    base_url = _base_url(api_key)
    if base_url is None:
        return ActionResult(
            success=False,
            message="Invalid API key format — expected a value ending in -xxNN (e.g. -us21).",
        )
    async with httpx.AsyncClient(timeout=MAILCHIMP_API_TIMEOUT) as client:
        response = await client.put(
            f"{base_url}/campaigns/{campaign_id}/content",
            auth=_auth(api_key),
            json={"html": html},
        )
    if response.status_code >= 400:
        return ActionResult(success=False, message=_error_message(response))
    return ActionResult(success=True, message="ok")


async def set_campaign_template_content(
    *, api_key: str, campaign_id: str, template_id: int, sections: dict[str, str]
) -> ActionResult:
    """Fills in a template-attached campaign's named editable content
    area(s) instead of replacing its whole design — `sections` keys must
    match the `mc:edit="..."` region names defined in the template's own
    HTML (see `get_template_default_content`, which returns those names
    along with their default content)."""
    base_url = _base_url(api_key)
    if base_url is None:
        return ActionResult(
            success=False,
            message="Invalid API key format — expected a value ending in -xxNN (e.g. -us21).",
        )
    async with httpx.AsyncClient(timeout=MAILCHIMP_API_TIMEOUT) as client:
        response = await client.put(
            f"{base_url}/campaigns/{campaign_id}/content",
            auth=_auth(api_key),
            json={"template": {"id": template_id, "sections": sections}},
        )
    if response.status_code >= 400:
        return ActionResult(success=False, message=_error_message(response))
    return ActionResult(success=True, message="ok")


async def send_campaign(*, api_key: str, campaign_id: str) -> ActionResult:
    """Sends immediately — irreversible, so the caller (see
    app.services.mailchimp_sync.create_and_send_campaign) only calls this
    after content has been set and everything else has succeeded."""
    base_url = _base_url(api_key)
    if base_url is None:
        return ActionResult(
            success=False,
            message="Invalid API key format — expected a value ending in -xxNN (e.g. -us21).",
        )
    async with httpx.AsyncClient(timeout=MAILCHIMP_API_TIMEOUT) as client:
        response = await client.post(
            f"{base_url}/campaigns/{campaign_id}/actions/send",
            auth=_auth(api_key),
        )
    if response.status_code >= 400:
        return ActionResult(success=False, message=_error_message(response))
    return ActionResult(success=True, message="sent")


async def send_test_email(
    *, api_key: str, campaign_id: str, test_emails: list[str]
) -> ActionResult:
    """Sends the campaign's already-set content to up to 10 arbitrary
    addresses for a preview — distinct from `send_campaign`: this never
    reaches the campaign's actual list/segment members, doesn't count as
    "sent" (the campaign stays a draft, sendable for real afterward), and
    can be called repeatedly."""
    base_url = _base_url(api_key)
    if base_url is None:
        return ActionResult(
            success=False,
            message="Invalid API key format — expected a value ending in -xxNN (e.g. -us21).",
        )
    async with httpx.AsyncClient(timeout=MAILCHIMP_API_TIMEOUT) as client:
        response = await client.post(
            f"{base_url}/campaigns/{campaign_id}/actions/test",
            auth=_auth(api_key),
            json={"test_emails": test_emails, "send_type": "html"},
        )
    if response.status_code >= 400:
        return ActionResult(success=False, message=_error_message(response))
    return ActionResult(success=True, message="sent")


@dataclass(frozen=True, slots=True)
class ReportsSummaryResult:
    success: bool
    message: str
    total_campaigns: int = 0
    emails_sent: int = 0
    opens: int = 0
    failed: int = 0


# Mailchimp's own page-size ceiling for a list endpoint like /reports —
# accounts with more sent campaigns than this would need real pagination,
# not handled here (the Reports page's summary is a best-effort total).
_REPORTS_PAGE_SIZE = 1000


async def get_reports_summary(*, api_key: str) -> ReportsSummaryResult:
    """Aggregates every campaign report in the account — this is Mailchimp's
    own send history, not scoped to campaigns sent through this app (there's
    no local record to scope by; see app.services.mailchimp_sync's module
    docstring). `opens` is unique opens (one per recipient who opened at
    least once, not total open events); `failed` is hard + soft bounces."""
    base_url = _base_url(api_key)
    if base_url is None:
        return ReportsSummaryResult(
            success=False,
            message="Invalid API key format — expected a value ending in -xxNN (e.g. -us21).",
        )
    async with httpx.AsyncClient(timeout=MAILCHIMP_API_TIMEOUT) as client:
        response = await client.get(
            f"{base_url}/reports",
            auth=_auth(api_key),
            params={
                "count": _REPORTS_PAGE_SIZE,
                "fields": "reports.emails_sent,reports.opens.unique_opens,"
                "reports.bounces.hard_bounces,reports.bounces.soft_bounces,total_items",
            },
        )
    if response.status_code >= 400:
        return ReportsSummaryResult(success=False, message=_error_message(response))

    body = response.json()
    reports = body.get("reports", [])
    emails_sent = sum(report.get("emails_sent", 0) for report in reports)
    opens = sum(report.get("opens", {}).get("unique_opens", 0) for report in reports)
    failed = sum(
        report.get("bounces", {}).get("hard_bounces", 0)
        + report.get("bounces", {}).get("soft_bounces", 0)
        for report in reports
    )
    return ReportsSummaryResult(
        success=True,
        message="ok",
        total_campaigns=body.get("total_items", len(reports)),
        emails_sent=emails_sent,
        opens=opens,
        failed=failed,
    )


def campaign_web_url(*, api_key: str, web_id: int) -> str | None:
    """Mailchimp's own dashboard URL for viewing a campaign's report —
    `web_id` (a short numeric id, distinct from the string `campaign_id`)
    is what its dashboard URLs are keyed on."""
    datacenter = _datacenter(api_key)
    if not datacenter:
        return None
    return f"https://{datacenter}.admin.mailchimp.com/campaigns/show/?id={web_id}"
