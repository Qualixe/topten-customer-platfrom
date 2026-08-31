"""`render_message` — the send-time counterpart to the frontend's
preview-only `{{token}}` substitution in message-preview.tsx."""

from datetime import date

from app.services.sms_campaigns_personalization import render_message


def test_replaces_customer_name_token() -> None:
    result = render_message("{{customer_name}} Hi, this is a test", customer_name="Rahim")
    assert result == "Rahim Hi, this is a test"


def test_replaces_multiple_occurrences() -> None:
    result = render_message(
        "Hi {{customer_name}}, is this really {{customer_name}}?", customer_name="Karim"
    )
    assert result == "Hi Karim, is this really Karim?"


def test_message_with_no_tokens_is_unchanged() -> None:
    result = render_message("Hello, no tokens here.", customer_name="Karim")
    assert result == "Hello, no tokens here."


def test_unrecognized_token_left_as_is() -> None:
    """A typo'd or unsupported token must fail visibly (shows up literally
    in the sent message) rather than silently vanishing."""
    result = render_message("Hi {{customer_nam}}!", customer_name="Karim")
    assert result == "Hi {{customer_nam}}!"


def test_replaces_form_link_token_when_given() -> None:
    result = render_message(
        "Hi {{customer_name}}, complete your profile: {{form_link}}",
        customer_name="Karim",
        form_link="https://topten.example/campaign/eid-2026?token=abc",
    )
    assert result == "Hi Karim, complete your profile: https://topten.example/campaign/eid-2026?token=abc"


def test_form_link_token_left_as_is_when_not_given() -> None:
    """No landing page attached — `form_link` stays unresolved rather than
    being blanked out, matching any other unrecognized token."""
    result = render_message("Hi {{customer_name}}! Link: {{form_link}}", customer_name="Karim")
    assert result == "Hi Karim! Link: {{form_link}}"


def test_replaces_phone_and_email_tokens_when_given() -> None:
    result = render_message(
        "{{phone}} / {{email}}",
        customer_name="Karim",
        phone="+8801711000101",
        email="karim@example.com",
    )
    assert result == "+8801711000101 / karim@example.com"


def test_phone_and_email_tokens_left_as_is_when_not_given() -> None:
    result = render_message("{{phone}} / {{email}}", customer_name="Karim")
    assert result == "{{phone}} / {{email}}"


def test_replaces_birthday_token_when_given() -> None:
    result = render_message(
        "Happy birthday, {{customer_name}}! Born {{birthday}}",
        customer_name="Karim",
        date_of_birth=date(1990, 3, 15),
    )
    assert result == "Happy birthday, Karim! Born March 15"


def test_birthday_token_left_as_is_when_not_given() -> None:
    result = render_message("Born {{birthday}}", customer_name="Karim")
    assert result == "Born {{birthday}}"


def test_current_date_token_always_available() -> None:
    """Unlike the other tokens, current_date needs no recipient data —
    it's always resolved, matching what the same day's SMS/email
    actually gets sent with."""
    result = render_message("Today: {{current_date}}", customer_name="Karim")
    assert result == f"Today: {date.today().strftime('%B %d, %Y')}"
