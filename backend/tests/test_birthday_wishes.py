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
from tests.support import get_customer_type_id

VALID_CREDENTIALS = {
    "api_url": "https://example.com/api/smsapi",
    "api_key": "key",
    "sender_id": "TOPTEN",
}


async def _add_customer(
    db_session: AsyncSession, *, name: str, phone: str, date_of_birth: date | None
) -> Customer:
    customer = Customer(
        name=name,
        phone=phone,
        normalized_phone=phone,
        date_of_birth=date_of_birth,
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
        auto_send_message=True,
        message_template=template,
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
    assert settings_row.auto_send_message is False
    assert settings_row.notify_days_before == 3
