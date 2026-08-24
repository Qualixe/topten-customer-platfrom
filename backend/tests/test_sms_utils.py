"""SMS encoding/segment/cost math — the Python mirror of frontend/lib/sms.ts.
Mirrors that file's own test scenarios so both stay in sync."""

from decimal import Decimal

from app.services.sms_campaigns_sms_utils import analyze_sms_message, estimate_sms_cost


def test_empty_message_has_zero_segments() -> None:
    result = analyze_sms_message("")
    assert result.segment_count == 0
    assert result.character_count == 0


def test_gsm7_single_segment_up_to_160_chars() -> None:
    result = analyze_sms_message("A" * 160)
    assert result.encoding == "GSM-7"
    assert result.segment_count == 1


def test_gsm7_multipart_at_161_chars() -> None:
    result = analyze_sms_message("A" * 161)
    assert result.encoding == "GSM-7"
    assert result.segment_count == 2
    assert result.character_count == 161


def test_gsm7_extended_char_costs_two_units() -> None:
    # "{" is a GSM-7 extended character (escape sequence -> 2 units).
    result = analyze_sms_message("{")
    assert result.encoding == "GSM-7"
    assert result.character_count == 2


def test_non_gsm7_character_forces_ucs2() -> None:
    result = analyze_sms_message("Hello 中文")
    assert result.encoding == "UCS-2"


def test_ucs2_single_segment_up_to_70_chars() -> None:
    result = analyze_sms_message("中" * 70)
    assert result.encoding == "UCS-2"
    assert result.segment_count == 1


def test_ucs2_multipart_at_71_chars() -> None:
    result = analyze_sms_message("中" * 71)
    assert result.encoding == "UCS-2"
    assert result.segment_count == 2


def test_surrogate_pair_emoji_counts_as_two_ucs2_units() -> None:
    # An emoji outside the Basic Multilingual Plane is a UTF-16 surrogate
    # pair on the wire — must count as 2, not 1.
    result = analyze_sms_message("😀")
    assert result.encoding == "UCS-2"
    assert result.character_count == 2
    assert result.segment_count == 1


def test_estimate_cost_multiplies_segments_recipients_and_rate() -> None:
    cost = estimate_sms_cost(2, 100, Decimal("0.45"))
    assert cost == Decimal("90.00")


def test_estimate_cost_zero_recipients_is_zero() -> None:
    assert estimate_sms_cost(3, 0, Decimal("0.45")) == Decimal("0.00")


def test_estimate_cost_rounds_to_two_decimal_places() -> None:
    cost = estimate_sms_cost(1, 3, Decimal("0.333"))
    assert cost == Decimal("1.00")
