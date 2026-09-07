"""Renders `{{token}}` personalization placeholders in a campaign message
for one specific recipient — the send-time counterpart to the frontend's
preview-only substitution in `message-preview.tsx`.

Supported tokens: `{{customer_name}}`, `{{form_link}}`, `{{profile_link}}`,
`{{phone}}`, `{{email}}`, `{{birthday}}`, `{{current_date}}`, `{{city}}`,
`{{company_name}}`, `{{campaign_name}}`. `form_link`/`profile_link`/`phone`/
`email`/`birthday`/`city` are only known when the caller has that data
available (e.g. `form_link`/`profile_link` need a resolved customer profile
link; `phone`/`email`/`birthday`/`city` come from the recipient snapshot
and may be null); `company_name`/`campaign_name` are only known when the
caller passes one (e.g. birthday wishes pass the configured store name;
campaign email sends pass the campaign's own name). `form_link` and
`profile_link` are two names for the same kind of value (a link back for
the customer) — SMS templates use `{{form_link}}` and email bodies use
`{{profile_link}}`, but a caller may pass either or both.
Like any other unrecognized `{{token}}`, an unavailable one is left
untouched rather than stripped or raising, so a typo'd token fails visibly
(it shows up literally in the sent message) instead of silently
vanishing.
"""

import re
from datetime import date

_TOKEN_PATTERN = re.compile(r"\{\{(\w+)\}\}")


def render_message(
    template: str,
    *,
    customer_name: str,
    form_link: str | None = None,
    profile_link: str | None = None,
    phone: str | None = None,
    email: str | None = None,
    date_of_birth: date | None = None,
    city: str | None = None,
    company_name: str | None = None,
    campaign_name: str | None = None,
) -> str:
    known_tokens = {
        "customer_name": customer_name,
        "current_date": date.today().strftime("%B %d, %Y"),
    }
    if form_link is not None:
        known_tokens["form_link"] = form_link
    if profile_link is not None:
        known_tokens["profile_link"] = profile_link
    if campaign_name is not None:
        known_tokens["campaign_name"] = campaign_name
    if phone is not None:
        known_tokens["phone"] = phone
    if email is not None:
        known_tokens["email"] = email
    if date_of_birth is not None:
        known_tokens["birthday"] = date_of_birth.strftime("%B %d")
    if city is not None:
        known_tokens["city"] = city
    if company_name is not None:
        known_tokens["company_name"] = company_name

    def _replace(match: re.Match[str]) -> str:
        key = match.group(1)
        return known_tokens.get(key, match.group(0))

    return _TOKEN_PATTERN.sub(_replace, template)
