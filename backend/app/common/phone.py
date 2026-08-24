"""Phone number normalization, backed by Google's libphonenumber
(the `phonenumbers` package) rather than ad-hoc string manipulation.

Phone is the sole customer-matching identifier for POS imports, so every
number must collapse to the exact same `normalized_phone` value regardless of
how the POS system happened to format it (spaces, dashes, a leading `0`
instead of the country code, etc.).
"""

import phonenumbers

from app.core.config import settings


class InvalidPhoneNumberError(ValueError):
    """Raised when a phone number cannot be parsed/is not a valid number."""


def normalize_phone(raw_phone: str, default_region: str | None = None) -> str:
    """
    Normalizes a raw phone number to E.164 (e.g. `+8801711000101`).

    `default_region` is used when `raw_phone` has no explicit country code
    (e.g. a POS export storing local numbers like `01711000101`). Defaults to
    `settings.IMPORT_DEFAULT_PHONE_REGION` (Bangladesh).

    Raises `InvalidPhoneNumberError` if the number can't be parsed or isn't a
    valid, possible number for its region.
    """
    region = default_region or settings.IMPORT_DEFAULT_PHONE_REGION
    candidate = raw_phone.strip()

    if not candidate:
        raise InvalidPhoneNumberError("Phone number is empty")

    try:
        parsed = phonenumbers.parse(candidate, region)
    except phonenumbers.NumberParseException as exc:
        raise InvalidPhoneNumberError(f"Could not parse phone number: {raw_phone!r}") from exc

    if not phonenumbers.is_valid_number(parsed):
        raise InvalidPhoneNumberError(f"Invalid phone number: {raw_phone!r}")

    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
