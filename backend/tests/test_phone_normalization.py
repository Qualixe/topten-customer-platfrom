"""Scenario 3: phone normalization."""

import pytest

from app.common.phone import InvalidPhoneNumberError, normalize_phone


@pytest.mark.parametrize(
    "raw",
    [
        "01711000101",
        "+8801711000101",
        "8801711000101",
        "017-1100-0101",
        "  01711000101  ",
    ],
)
def test_various_formats_normalize_to_the_same_e164_number(raw: str) -> None:
    assert normalize_phone(raw) == "+8801711000101"


def test_different_numbers_normalize_differently() -> None:
    assert normalize_phone("01711000101") != normalize_phone("01711000102")


@pytest.mark.parametrize("raw", ["", "   ", "123", "not-a-phone", "0000000"])
def test_invalid_numbers_raise(raw: str) -> None:
    with pytest.raises(InvalidPhoneNumberError):
        normalize_phone(raw)


def test_explicit_region_overrides_default() -> None:
    # A US-formatted number should normalize under the US region even though
    # the app default region is Bangladesh.
    assert normalize_phone("(202) 555-0173", default_region="US") == "+12025550173"
