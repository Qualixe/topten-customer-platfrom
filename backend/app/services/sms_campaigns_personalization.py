"""Renders `{{token}}` personalization placeholders in a campaign message
for one specific recipient — the send-time counterpart to the frontend's
preview-only substitution in `message-preview.tsx`.

Only `{{customer_name}}` is a real, supported token right now (matching
`PERSONALIZATION_TOKENS` on the frontend — the only token exposed there).
An unrecognized `{{token}}` is left untouched rather than stripped or
raising, so a typo'd token fails visibly (it shows up literally in the
sent message) instead of silently vanishing.
"""

import re

_TOKEN_PATTERN = re.compile(r"\{\{(\w+)\}\}")


def render_message(template: str, *, customer_name: str) -> str:
    known_tokens = {"customer_name": customer_name}

    def _replace(match: re.Match[str]) -> str:
        key = match.group(1)
        return known_tokens.get(key, match.group(0))

    return _TOKEN_PATTERN.sub(_replace, template)
