"""Renders `{{token}}` personalization placeholders in a campaign message
for one specific recipient — the send-time counterpart to the frontend's
preview-only substitution in `message-preview.tsx`.

Supported tokens: `{{customer_name}}`, `{{form_link}}`, `{{phone}}`,
`{{email}}`, `{{birthday}}`, `{{current_date}}`, `{{city}}`,
`{{company_name}}`. `form_link`/`phone`/`email`/`birthday`/`city` are only
known when the caller has that data available (e.g. `form_link` needs a
published landing page; `phone`/`email`/`birthday`/`city` come from the
recipient snapshot and may be null); `company_name` is only known when the
caller passes one (e.g. birthday wishes pass the configured store name).
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
    phone: str | None = None,
    email: str | None = None,
    date_of_birth: date | None = None,
    city: str | None = None,
    company_name: str | None = None,
) -> str:
    known_tokens = {
        "customer_name": customer_name,
        "current_date": date.today().strftime("%B %d, %Y"),
    }
    if form_link is not None:
        known_tokens["form_link"] = form_link
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
