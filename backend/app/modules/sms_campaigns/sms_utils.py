"""Pure SMS calculation utilities: encoding detection (GSM-7 vs UCS-2) and
segment/cost math.

This is a deliberate Python port of `frontend/lib/sms.ts` — kept in sync so
the backend's authoritative segment count/cost always matches what the
campaign composer UI estimates before submitting. See that file for the
detailed rules; the short version:

- GSM-7: 160 characters for a single SMS, 153 per segment once multipart.
  Extended GSM-7 characters (`{ } [ ] ~ ^ | €` and form feed) cost 2 units
  each, since they're sent as an escape sequence.
- UCS-2: 70 characters for a single SMS, 67 per segment once multipart.

Python's `str` already iterates by Unicode code point (unlike JavaScript's
UTF-16-code-unit-based strings), which matches the GSM-7 detection step
directly. For UCS-2 billing, character count must still be UTF-16 code
units (a character outside the Basic Multilingual Plane is a surrogate
pair on the wire and correctly costs 2 of the 70/67 budget) — computed
explicitly below via a UTF-16 encode rather than `len()`.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

GSM_7_BASIC_ROWS = [
    "@£$¥èéùìòÇ\nØø\rÅå",
    "Δ_ΦΓΛΩΠΨΣΘΞÆæßÉ",
    " !\"#¤%&'()*+,-./",
    "0123456789:;<=>?",
    "¡ABCDEFGHIJKLMNO",
    "PQRSTUVWXYZÄÖÑÜ§",
    "¿abcdefghijklmno",
    "pqrstuvwxyzäöñüà",
]
GSM_7_EXTENDED_CHARS = "\f^{}\\[~]|€"

GSM_7_BASIC_SET = set("".join(GSM_7_BASIC_ROWS))
GSM_7_EXTENDED_SET = set(GSM_7_EXTENDED_CHARS)

GSM_7_SINGLE_LIMIT = 160
GSM_7_MULTIPART_LIMIT = 153
UCS_2_SINGLE_LIMIT = 70
UCS_2_MULTIPART_LIMIT = 67


@dataclass(frozen=True, slots=True)
class SmsAnalysis:
    encoding: str  # "GSM-7" | "UCS-2"
    character_count: int
    segment_count: int


def _is_gsm7_code_point(char: str) -> bool:
    return char in GSM_7_BASIC_SET or char in GSM_7_EXTENDED_SET


def _gsm7_unit_cost(char: str) -> int:
    return 2 if char in GSM_7_EXTENDED_SET else 1


def _segment_count(character_count: int, single_limit: int, multipart_limit: int) -> int:
    if character_count == 0:
        return 0
    if character_count <= single_limit:
        return 1
    return -(-character_count // multipart_limit)  # ceil division


def analyze_sms_message(text: str) -> SmsAnalysis:
    is_gsm7 = all(_is_gsm7_code_point(char) for char in text)

    if is_gsm7:
        character_count = sum(_gsm7_unit_cost(char) for char in text)
        return SmsAnalysis(
            encoding="GSM-7",
            character_count=character_count,
            segment_count=_segment_count(
                character_count, GSM_7_SINGLE_LIMIT, GSM_7_MULTIPART_LIMIT
            ),
        )

    character_count = len(text.encode("utf-16-le")) // 2
    return SmsAnalysis(
        encoding="UCS-2",
        character_count=character_count,
        segment_count=_segment_count(character_count, UCS_2_SINGLE_LIMIT, UCS_2_MULTIPART_LIMIT),
    )


def estimate_sms_cost(segments: int, recipients: int, rate_per_segment: Decimal) -> Decimal:
    """Rounded to 2 decimal places (currency subunits), matching the
    frontend's `Math.round(rawCost * 100) / 100`."""
    raw_cost = Decimal(segments) * Decimal(recipients) * rate_per_segment
    return raw_cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
