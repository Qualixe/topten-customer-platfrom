"""Per-row and per-batch validation for POS customer imports.

A bad row must never crash the whole import — `validate_row` always returns
a result object (`ValidRow` or `RowError`), never raises, so the caller can
just keep going and record the error for the admin to review later.
"""

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from app.common.phone import InvalidPhoneNumberError, normalize_phone

MIN_PERIOD_YEAR = 2000
MAX_PERIOD_YEAR = 2100

# Real POS exports don't all use the same header names. "id"/"card no" as a
# phone source is specific to exports (like TopTen's own POS) where the
# customer's card number/ID *is* their phone number — confirmed against a
# real export where both columns held the same value as the phone embedded
# in the address field.
NAME_COLUMN_ALIASES = ("name", "customer name")
PHONE_COLUMN_ALIASES = ("phone", "card no", "card number", "id")
AMOUNT_COLUMN_ALIASES = ("amount", "spending", "total spent", "total amount")


def _normalize_header(header: str) -> str:
    return re.sub(r"\s+", " ", header.strip()).lower()


def _find_column_value(normalized_row: dict[str, str], aliases: tuple[str, ...]) -> str:
    for alias in aliases:
        value = normalized_row.get(alias)
        if value and value.strip():
            return value.strip()
    return ""


def _has_any_column(normalized_row: dict[str, str], aliases: tuple[str, ...]) -> bool:
    return any(alias in normalized_row for alias in aliases)


@dataclass(frozen=True, slots=True)
class ValidRow:
    row_number: int
    name: str
    raw_phone: str
    normalized_phone: str
    amount: Decimal


@dataclass(frozen=True, slots=True)
class RowError:
    row_number: int
    raw_row: dict[str, str]
    message: str


class InvalidPeriodError(ValueError):
    """Raised when the import batch's period (year/month) is out of range."""


def validate_period(year: int, month: int) -> None:
    if not (MIN_PERIOD_YEAR <= year <= MAX_PERIOD_YEAR):
        raise InvalidPeriodError(
            f"period_year must be between {MIN_PERIOD_YEAR} and {MAX_PERIOD_YEAR}"
        )
    if not (1 <= month <= 12):
        raise InvalidPeriodError("period_month must be between 1 and 12")


def validate_row(
    raw_row: dict[str, str], row_number: int, *, default_phone_region: str
) -> ValidRow | RowError:
    normalized_row = {_normalize_header(key): value for key, value in raw_row.items()}

    name = _find_column_value(normalized_row, NAME_COLUMN_ALIASES)
    phone = _find_column_value(normalized_row, PHONE_COLUMN_ALIASES)

    if not phone:
        return RowError(row_number, raw_row, "Missing phone number")

    try:
        normalized_phone = normalize_phone(phone, default_phone_region)
    except InvalidPhoneNumberError as exc:
        return RowError(row_number, raw_row, str(exc))

    if not name:
        # Some POS records only have a phone/card number on file, no name —
        # rather than rejecting these customers, use the phone as a
        # placeholder identifier so they still get imported. Phone is the
        # real identity key either way (see normalized_phone above).
        name = phone

    # A file with no spending-amount column at all (e.g. a customer
    # directory export) isn't an error — it just has nothing to record for
    # this period, so spending defaults to 0. A file that *has* an amount
    # column but leaves it blank on a given row is still a data problem.
    if _has_any_column(normalized_row, AMOUNT_COLUMN_ALIASES):
        amount_raw = _find_column_value(normalized_row, AMOUNT_COLUMN_ALIASES)
        if not amount_raw:
            return RowError(row_number, raw_row, "Missing spending amount")
        try:
            amount = Decimal(amount_raw)
        except InvalidOperation:
            return RowError(row_number, raw_row, f"Invalid spending amount: {amount_raw!r}")
        if amount < 0:
            return RowError(row_number, raw_row, "Spending amount cannot be negative")
    else:
        amount = Decimal("0")

    return ValidRow(
        row_number=row_number,
        name=name,
        raw_phone=phone,
        normalized_phone=normalized_phone,
        amount=amount,
    )
