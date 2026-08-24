"""Scenario 9: invalid rows must not crash the import — they're recorded for
later admin review instead."""

from decimal import Decimal

from app.modules.imports.validation import RowError, ValidRow, validate_row


def _validate(raw: dict[str, str]) -> RowError | ValidRow:
    return validate_row(raw, row_number=1, default_phone_region="BD")


def test_missing_phone_is_invalid() -> None:
    result = _validate({"name": "Rahim", "phone": "", "amount": "1000"})
    assert isinstance(result, RowError)
    assert "phone" in result.message.lower()


def test_missing_name_falls_back_to_phone() -> None:
    """Some real POS records have a phone/card number on file but no name —
    rather than rejecting these customers, the phone becomes a placeholder
    name so they still get imported (phone is the real identity key either
    way). Changed from an earlier version of this test that rejected a
    blank name outright."""
    result = _validate({"name": "", "phone": "01711000101", "amount": "1000"})
    assert isinstance(result, ValidRow)
    assert result.name == "01711000101"


def test_malformed_phone_is_invalid() -> None:
    result = _validate({"name": "Rahim", "phone": "not-a-phone", "amount": "1000"})
    assert isinstance(result, RowError)


def test_missing_amount_is_invalid() -> None:
    result = _validate({"name": "Rahim", "phone": "01711000101", "amount": ""})
    assert isinstance(result, RowError)


def test_non_numeric_amount_is_invalid() -> None:
    result = _validate({"name": "Rahim", "phone": "01711000101", "amount": "ten-thousand"})
    assert isinstance(result, RowError)


def test_negative_amount_is_invalid() -> None:
    result = _validate({"name": "Rahim", "phone": "01711000101", "amount": "-500"})
    assert isinstance(result, RowError)


def test_valid_row_passes() -> None:
    result = _validate({"name": "Rahim Uddin", "phone": "01711000101", "amount": "10000"})
    assert isinstance(result, ValidRow)
    assert result.normalized_phone == "+8801711000101"


def test_zero_amount_is_valid() -> None:
    """Zero spending is a legitimate value (e.g. a registered customer with
    no purchases this month), not an error."""
    result = _validate({"name": "Rahim Uddin", "phone": "01711000101", "amount": "0"})
    assert isinstance(result, ValidRow)


# Real-world POS exports (e.g. a customer directory export) don't always use
# the documented name/phone/amount headers.


def test_recognizes_customer_name_and_card_no_headers() -> None:
    """Matches a real POS export's actual column names — see the
    'CustomerReport.csv' format with 'Customer  Name' / 'Card no' / 'ID'
    (no leading zero on the phone) and no amount column at all."""
    result = _validate(
        {
            " ID": "1980776016",
            "Customer  Name": "MD UJJAL MIA",
            "Card no": "1980776016",
        }
    )
    assert isinstance(result, ValidRow)
    assert result.name == "MD UJJAL MIA"
    assert result.normalized_phone == "+8801980776016"
    assert result.amount == Decimal("0")


def test_prefers_card_no_over_id_when_both_present() -> None:
    result = _validate(
        {
            "ID": "1980776016",
            "Customer  Name": "MD UJJAL MIA",
            "Card no": "1572906693",
        }
    )
    assert isinstance(result, ValidRow)
    assert result.normalized_phone == "+8801572906693"


def test_amount_column_present_but_blank_is_still_invalid() -> None:
    """Distinguishes "no amount column at all" (defaults to 0) from "amount
    column exists but this row left it blank" (still a data problem)."""
    result = _validate({"Customer  Name": "Rahim", "Card no": "01711000101", "amount": ""})
    assert isinstance(result, RowError)
    assert "amount" in result.message.lower()


def test_plain_documented_headers_still_work_unchanged() -> None:
    result = _validate({"name": "Rahim Uddin", "phone": "01711000101", "amount": "10000"})
    assert isinstance(result, ValidRow)
    assert result.amount == Decimal("10000")
