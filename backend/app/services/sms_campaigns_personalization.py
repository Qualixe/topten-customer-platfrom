"""Renders `{{token}}` personalization placeholders in a campaign message
for one specific recipient — the send-time counterpart to the frontend's
preview-only substitution in `message-preview.tsx`.

Supported tokens: `{{customer_name}}`, `{{form_link}}`, `{{phone}}`,
`{{email}}`, `{{birthday}}`, `{{current_date}}`. `form_link`/`phone`/
`email`/`birthday` are only known when the caller has that data available
(e.g. `form_link` needs a published landing page; `phone`/`email`/
`birthday` come from the recipient snapshot and may be null) — like any
other unrecognized `{{token}}`, an unavailable one is left untouched
rather than stripped or raising, so a typo'd token fails visibly (it shows
up literally in the sent message) instead of silently vanishing. Not
supported: `{{city}}` (no structured city field — only a free-text
address) and `{{company}}` (no such concept on Customer, an individual
retail-customer record) — inventing either would mean sending fabricated
data to a real recipient.
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

    def _replace(match: re.Match[str]) -> str:
        key = match.group(1)
        return known_tokens.get(key, match.group(0))

    return _TOKEN_PATTERN.sub(_replace, template)
