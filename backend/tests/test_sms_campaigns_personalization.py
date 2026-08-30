"""`render_message` — the send-time counterpart to the frontend's
preview-only `{{token}}` substitution in message-preview.tsx."""

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
