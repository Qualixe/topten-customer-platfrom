"""Exercises `send_todays_birthday_wishes` directly against the test
database. Never hits a real gateway: `gateway_send_sms` (the aliased import
in `app.services.birthday_wishes`) is mocked in every test here — same
convention as test_campaign_sending.py."""

from datetime import date
from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import merge_credential_data
from app.common.sms_gateway_client import SendSmsResult
from app.models.customer import Customer
from app.services.birthday_wishes import (
    get_or_create_birthday_settings,
    send_todays_birthday_wishes,
    update_birthday_settings,
)
from app.services.sms_campaigns import SMS_GATEWAY_PROVIDER
from app.views.mailchimp_marketing import SendCampaignReport
from tests.support import get_customer_type_id

VALID_CREDENTIALS = {
    "api_url": "https://example.com/api/smsapi",
    "api_key": "key",
    "sender_id": "TOPTEN",
}


async def _add_customer(
    db_session: AsyncSession,
    *,
    name: str,
    phone: str,
    date_of_birth: date | None,
    email: str | None = None,
    marketing_opt_in: bool = False,
) -> Customer:
    customer = Customer(
        name=name,
        phone=phone,
        normalized_phone=phone,
        date_of_birth=date_of_birth,
        email=email,
        marketing_opt_in=marketing_opt_in,
        customer_type_id=await get_customer_type_id(db_session),
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def _enable_auto_send(db_session: AsyncSession, template: str = "Happy Birthday, {{customer_name}}!") -> None:
    await update_birthday_settings(
        db_session,
        notify_days_before=3,
        enabled=True,
        channel="SMS",
        send_hour=9,
        send_minute=0,
        company_name="",
        message_template=template,
        email_subject="Happy Birthday, {{customer_name}}!",
        email_message_template="<p>Happy Birthday, {{customer_name}}!</p>",
        auto_assign_gift=False,
    )


async def test_noop_when_auto_send_disabled(db_session: AsyncSession) -> None:
    await merge_credential_data(db_session, SMS_GATEWAY_PROVIDER, VALID_CREDENTIALS)
    await _add_customer(
        db_session, name="A", phone="+8801711000101", date_of_birth=date(1990, 6, 15)
    )

    with patch(
        "app.services.birthday_wishes.gateway_send_sms", new=AsyncMock()
    ) as mock_send:
        report = await send_todays_birthday_wishes(db_session, today=date(2026, 6, 15))

    mock_send.assert_not_called()
    assert report.total == 0
    assert report.sent == 0


async def test_noop_without_gateway_credentials(db_session: AsyncSession) -> None:
    await _enable_auto_send(db_session)
    await _add_customer(
        db_session, name="A", phone="+8801711000101", date_of_birth=date(1990, 6, 15)
    )

    with patch(
        "app.services.birthday_wishes.gateway_send_sms", new=AsyncMock()
    ) as mock_send:
        report = await send_todays_birthday_wishes(db_session, today=date(2026, 6, 15))

    mock_send.assert_not_called()
    assert report.total == 0


async def test_sends_to_customer_with_birthday_today_only(db_session: AsyncSession) -> None:
    await merge_credential_data(db_session, SMS_GATEWAY_PROVIDER, VALID_CREDENTIALS)
    await _enable_auto_send(db_session)
    birthday_customer = await _add_customer(
        db_session, name="Rahim Uddin", phone="+8801711000101", date_of_birth=date(1990, 6, 15)
    )
    await _add_customer(
        db_session, name="Not Today", phone="+8801711000102", date_of_birth=date(1990, 6, 16)
    )

    mock_result = SendSmsResult(success=True, http_status=200, message="OK")
    with patch(
        "app.services.birthday_wishes.gateway_send_sms", new=AsyncMock(return_value=mock_result)
    ) as mock_send:
        report = await send_todays_birthday_wishes(db_session, today=date(2026, 6, 15))

    assert report.total == 1
    assert report.sent == 1
    assert report.failed == 0
    mock_send.assert_called_once()
    _, kwargs = mock_send.call_args
    assert kwargs["number"] == "+8801711000101"
    assert kwargs["message"] == "Happy Birthday, Rahim Uddin!"
    assert kwargs["sender_id"] == "TOPTEN"

    await db_session.refresh(birthday_customer)
    assert birthday_customer.last_birthday_wish_year == 2026


async def test_skips_customer_already_wished_this_year(db_session: AsyncSession) -> None:
    await merge_credential_data(db_session, SMS_GATEWAY_PROVIDER, VALID_CREDENTIALS)
    await _enable_auto_send(db_session)
    customer = await _add_customer(
        db_session, name="A", phone="+8801711000101", date_of_birth=date(1990, 6, 15)
    )
    customer.last_birthday_wish_year = 2026
    await db_session.commit()

    with patch(
        "app.services.birthday_wishes.gateway_send_sms", new=AsyncMock()
    ) as mock_send:
        report = await send_todays_birthday_wishes(db_session, today=date(2026, 6, 15))

    mock_send.assert_not_called()
    assert report.total == 1
    assert report.sent == 0
    assert report.skipped_already_sent == 1


async def test_leap_year_birthday_wished_on_feb_28_in_non_leap_year(
    db_session: AsyncSession,
) -> None:
    await merge_credential_data(db_session, SMS_GATEWAY_PROVIDER, VALID_CREDENTIALS)
    await _enable_auto_send(db_session)
    await _add_customer(
        db_session, name="Leap Baby", phone="+8801711000101", date_of_birth=date(1992, 2, 29)
    )

    mock_result = SendSmsResult(success=True, http_status=200, message="OK")
    with patch(
        "app.services.birthday_wishes.gateway_send_sms", new=AsyncMock(return_value=mock_result)
    ) as mock_send:
        report = await send_todays_birthday_wishes(db_session, today=date(2026, 2, 28))

    mock_send.assert_called_once()
    assert report.sent == 1


async def test_get_or_create_birthday_settings_defaults(db_session: AsyncSession) -> None:
    settings_row = await get_or_create_birthday_settings(db_session)
    assert settings_row.enabled is False
    assert settings_row.channel == "SMS"
    assert settings_row.send_hour == 9
    assert settings_row.send_minute == 0
    assert settings_row.notify_days_before == 3
    assert settings_row.last_run_at is None


async def _enable_auto_send_email(
    db_session: AsyncSession, subject: str = "Happy Birthday, {{customer_name}}!"
) -> None:
    await update_birthday_settings(
        db_session,
        notify_days_before=3,
        enabled=True,
        channel="EMAIL",
        send_hour=9,
        send_minute=0,
        company_name="",
        message_template="Happy Birthday, {{customer_name}}!",
        email_subject=subject,
        email_message_template="<p>Happy Birthday, {{customer_name}}!</p>",
        auto_assign_gift=False,
    )


async def test_email_noop_when_disabled(db_session: AsyncSession) -> None:
    await _add_customer(
        db_session,
        name="A",
        phone="+8801711000101",
        date_of_birth=date(1990, 6, 15),
        email="a@example.com",
        marketing_opt_in=True,
    )

    with patch(
        "app.services.birthday_wishes.create_and_send_campaign", new=AsyncMock()
    ) as mock_send:
        report = await send_todays_birthday_wishes(db_session, today=date(2026, 6, 15))

    mock_send.assert_not_called()
    assert report.email_total == 0
    assert report.email_sent == 0


async def test_sends_email_to_customer_with_birthday_today(db_session: AsyncSession) -> None:
    await _enable_auto_send_email(db_session)
    birthday_customer = await _add_customer(
        db_session,
        name="Rahim Uddin",
        phone="+8801711000101",
        date_of_birth=date(1990, 6, 15),
        email="rahim@example.com",
        marketing_opt_in=True,
    )
    await _add_customer(
        db_session,
        name="No Email",
        phone="+8801711000102",
        date_of_birth=date(1990, 6, 15),
        email=None,
        marketing_opt_in=True,
    )

    mock_report = SendCampaignReport(total=1, sent=1, failed=0, items=[])
    with patch(
        "app.services.birthday_wishes.create_and_send_campaign",
        new=AsyncMock(return_value=mock_report),
    ) as mock_send:
        report = await send_todays_birthday_wishes(db_session, today=date(2026, 6, 15))

    assert report.email_total == 1
    assert report.email_sent == 1
    assert report.email_failed == 0
    mock_send.assert_called_once()
    _, kwargs = mock_send.call_args
    assert kwargs["customer_ids"] == [birthday_customer.public_id]
    assert kwargs["subject"] == "Happy Birthday, Rahim Uddin!"
    assert "Rahim Uddin" in kwargs["html_body"]

    await db_session.refresh(birthday_customer)
    assert birthday_customer.last_birthday_email_year == 2026


async def test_skips_customer_already_emailed_this_year(db_session: AsyncSession) -> None:
    await _enable_auto_send_email(db_session)
    customer = await _add_customer(
        db_session,
        name="A",
        phone="+8801711000101",
        date_of_birth=date(1990, 6, 15),
        email="a@example.com",
        marketing_opt_in=True,
    )
    customer.last_birthday_email_year = 2026
    await db_session.commit()

    with patch(
        "app.services.birthday_wishes.create_and_send_campaign", new=AsyncMock()
    ) as mock_send:
        report = await send_todays_birthday_wishes(db_session, today=date(2026, 6, 15))

    mock_send.assert_not_called()
    assert report.email_total == 1
    assert report.email_sent == 0
    assert report.email_skipped_already_sent == 1


async def test_sms_and_email_tracked_independently(db_session: AsyncSession) -> None:
    """A customer already wished by SMS this year still gets the email wish
    (and vice versa) — the two channels must not share one idempotency
    column."""
    await merge_credential_data(db_session, SMS_GATEWAY_PROVIDER, VALID_CREDENTIALS)
    await update_birthday_settings(
        db_session,
        notify_days_before=3,
        enabled=True,
        channel="BOTH",
        send_hour=9,
        send_minute=0,
        company_name="",
        message_template="Happy Birthday, {{customer_name}}!",
        email_subject="Happy Birthday, {{customer_name}}!",
        email_message_template="<p>Happy Birthday, {{customer_name}}!</p>",
        auto_assign_gift=False,
    )
    customer = await _add_customer(
        db_session,
        name="A",
        phone="+8801711000101",
        date_of_birth=date(1990, 6, 15),
        email="a@example.com",
        marketing_opt_in=True,
    )
    customer.last_birthday_wish_year = 2026
    await db_session.commit()

    mock_report = SendCampaignReport(total=1, sent=1, failed=0, items=[])
    with (
        patch("app.services.birthday_wishes.gateway_send_sms", new=AsyncMock()) as mock_sms,
        patch(
            "app.services.birthday_wishes.create_and_send_campaign",
            new=AsyncMock(return_value=mock_report),
        ) as mock_email,
    ):
        report = await send_todays_birthday_wishes(db_session, today=date(2026, 6, 15))

    mock_sms.assert_not_called()
    assert report.skipped_already_sent == 1
    mock_email.assert_called_once()
    assert report.email_sent == 1


async def test_sms_only_channel_never_sends_email(db_session: AsyncSession) -> None:
    await merge_credential_data(db_session, SMS_GATEWAY_PROVIDER, VALID_CREDENTIALS)
    await _enable_auto_send(db_session)
    await _add_customer(
        db_session,
        name="A",
        phone="+8801711000101",
        date_of_birth=date(1990, 6, 15),
        email="a@example.com",
        marketing_opt_in=True,
    )

    mock_result = SendSmsResult(success=True, http_status=200, message="OK")
    with (
        patch(
            "app.services.birthday_wishes.gateway_send_sms",
            new=AsyncMock(return_value=mock_result),
        ),
        patch(
            "app.services.birthday_wishes.create_and_send_campaign", new=AsyncMock()
        ) as mock_email,
    ):
        report = await send_todays_birthday_wishes(db_session, today=date(2026, 6, 15))

    mock_email.assert_not_called()
    assert report.sent == 1
    assert report.email_total == 0


async def test_last_run_at_set_when_enabled_and_untouched_when_disabled(
    db_session: AsyncSession,
) -> None:
    settings_row = await get_or_create_birthday_settings(db_session)
    assert settings_row.last_run_at is None

    await send_todays_birthday_wishes(db_session, today=date(2026, 6, 15))
    await db_session.refresh(settings_row)
    assert settings_row.last_run_at is None

    await _enable_auto_send(db_session)
    await send_todays_birthday_wishes(db_session, today=date(2026, 6, 15))
    await db_session.refresh(settings_row)
    assert settings_row.last_run_at is not None


async def test_city_and_company_name_tokens_rendered(db_session: AsyncSession) -> None:
    await merge_credential_data(db_session, SMS_GATEWAY_PROVIDER, VALID_CREDENTIALS)
    await update_birthday_settings(
        db_session,
        notify_days_before=3,
        enabled=True,
        channel="SMS",
        send_hour=9,
        send_minute=0,
        company_name="Pulsedesk",
        message_template="Happy Birthday, {{customer_name}} from {{city}}! Love, {{company_name}}.",
        email_subject="Happy Birthday, {{customer_name}}!",
        email_message_template="<p>Happy Birthday, {{customer_name}}!</p>",
        auto_assign_gift=False,
    )
    customer = await _add_customer(
        db_session, name="Rahim Uddin", phone="+8801711000101", date_of_birth=date(1990, 6, 15)
    )
    customer.city = "Dhaka"
    await db_session.commit()

    mock_result = SendSmsResult(success=True, http_status=200, message="OK")
    with patch(
        "app.services.birthday_wishes.gateway_send_sms", new=AsyncMock(return_value=mock_result)
    ) as mock_send:
        await send_todays_birthday_wishes(db_session, today=date(2026, 6, 15))

    _, kwargs = mock_send.call_args
    assert kwargs["message"] == "Happy Birthday, Rahim Uddin from Dhaka! Love, Pulsedesk."
