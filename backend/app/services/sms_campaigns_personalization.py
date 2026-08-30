"""Renders `{{token}}` personalization placeholders in a campaign message
for one specific recipient — the send-time counterpart to the frontend's
preview-only substitution in `message-preview.tsx`.

`{{customer_name}}` and `{{form_link}}` are the only real, supported
tokens right now. `form_link` is only known when the campaign has a
landing page (see app.tasks.sms_campaigns) — otherwise, like any other
unrecognized `{{token}}`, it's left untouched rather than stripped or
raising, so a typo'd token fails visibly (it shows up literally in the
sent message) instead of silently vanishing.
"""

import re

_TOKEN_PATTERN = re.compile(r"\{\{(\w+)\}\}")


def render_message(template: str, *, customer_name: str, form_link: str | None = None) -> str:
    known_tokens = {"customer_name": customer_name}
    if form_link is not None:
        known_tokens["form_link"] = form_link

    def _replace(match: re.Match[str]) -> str:
        key = match.group(1)
        return known_tokens.get(key, match.group(0))

    return _TOKEN_PATTERN.sub(_replace, template)
