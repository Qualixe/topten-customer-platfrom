from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import (
    PlainFieldStatus,
    SecretFieldStatus,
    get_or_create_credential_row,
    merge_credential_data,
)
from app.common.dependencies import get_db, require_permission
from app.common.phone import InvalidPhoneNumberError, normalize_phone
from app.common.rate_limit import rate_limit
from app.common.sms_gateway_client import RequestStyle, get_balance, send_sms
from app.core.config import settings
from app.views.notifications import (
    DEFAULT_API_KEY_FIELD,
    DEFAULT_MESSAGE_FIELD,
    DEFAULT_NUMBER_FIELD,
    DEFAULT_SENDER_ID_FIELD,
    SmsBalance,
    SmsBalanceResponse,
    SmsGatewayCredentialsResponse,
    SmsGatewayCredentialsStatus,
    SmsGatewayCredentialsUpdate,
    TestSmsRequest,
    TestSmsResponse,
    TestSmsResult,
)

router = APIRouter(dependencies=[Depends(require_permission("settings.manage"))])

SMS_GATEWAY_PROVIDER = "sms_gateway"


def _to_status(data: dict[str, str | None]) -> SmsGatewayCredentialsStatus:
    return SmsGatewayCredentialsStatus(
        api_url=PlainFieldStatus(value=data.get("api_url")),
        api_key=SecretFieldStatus(is_set=bool(data.get("api_key"))),
        sender_id=PlainFieldStatus(value=data.get("sender_id")),
        rate_per_segment_bdt=PlainFieldStatus(
            value=data.get("rate_per_segment_bdt") or str(settings.SMS_RATE_PER_SEGMENT_BDT)
        ),
        request_style=PlainFieldStatus(
            value=data.get("request_style") or RequestStyle.GET_QUERY.value
        ),
        api_key_field=PlainFieldStatus(value=data.get("api_key_field") or DEFAULT_API_KEY_FIELD),
        sender_id_field=PlainFieldStatus(
            value=data.get("sender_id_field") or DEFAULT_SENDER_ID_FIELD
        ),
        number_field=PlainFieldStatus(value=data.get("number_field") or DEFAULT_NUMBER_FIELD),
        message_field=PlainFieldStatus(value=data.get("message_field") or DEFAULT_MESSAGE_FIELD),
        request_id_field=PlainFieldStatus(value=data.get("request_id_field")),
        success_field=PlainFieldStatus(value=data.get("success_field")),
        success_value=PlainFieldStatus(value=data.get("success_value")),
        balance_url=PlainFieldStatus(value=data.get("balance_url")),
    )


@router.get("/sms-gateway/credentials", response_model=SmsGatewayCredentialsResponse)
async def get_sms_gateway_credentials(
    db: AsyncSession = Depends(get_db),
) -> SmsGatewayCredentialsResponse:
    row = await get_or_create_credential_row(db, SMS_GATEWAY_PROVIDER)
    return SmsGatewayCredentialsResponse(data=_to_status(row.data))


@router.put("/sms-gateway/credentials", response_model=SmsGatewayCredentialsResponse)
async def update_sms_gateway_credentials(
    payload: SmsGatewayCredentialsUpdate, db: AsyncSession = Depends(get_db)
) -> SmsGatewayCredentialsResponse:
    # mode="json" serializes `request_style` (a RequestStyle enum member) to
    # its plain string value — the JSONB column stores plain strings, and
    # `RequestStyle(value)` reconstructs the enum on the way back out.
    updates = payload.model_dump(exclude_unset=True, mode="json")
    data = await merge_credential_data(db, SMS_GATEWAY_PROVIDER, updates)
    return SmsGatewayCredentialsResponse(data=_to_status(data))


@router.post("/sms-gateway/test-sms", response_model=TestSmsResponse)
async def send_sms_gateway_test_sms(
    payload: TestSmsRequest,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(rate_limit("test-sms", max_requests=5, window_seconds=60)),
) -> TestSmsResponse:
    """Sends one real SMS to a number the caller explicitly typed in, using
    the configured gateway's full request shape (URL, method/body style,
    field names, credentials). Deliberately never wired to campaigns/
    customer data: this is for verifying a gateway actually works, not for
    reaching real customers."""
    row = await get_or_create_credential_row(db, SMS_GATEWAY_PROVIDER)
    api_url = row.data.get("api_url")
    api_key = row.data.get("api_key")
    sender_id = row.data.get("sender_id")
    if not api_url or not api_key or not sender_id:
        raise HTTPException(
            status_code=422,
            detail="Save an API URL, API key, and sender ID in settings before sending a test.",
        )

    try:
        number = normalize_phone(payload.number)
    except InvalidPhoneNumberError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    result = await send_sms(
        api_url=api_url,
        api_key=api_key,
        sender_id=sender_id,
        number=number,
        message=payload.message,
        request_style=RequestStyle(row.data.get("request_style") or RequestStyle.GET_QUERY.value),
        api_key_field=row.data.get("api_key_field") or DEFAULT_API_KEY_FIELD,
        sender_id_field=row.data.get("sender_id_field") or DEFAULT_SENDER_ID_FIELD,
        number_field=row.data.get("number_field") or DEFAULT_NUMBER_FIELD,
        message_field=row.data.get("message_field") or DEFAULT_MESSAGE_FIELD,
        request_id_field=row.data.get("request_id_field"),
        success_field=row.data.get("success_field"),
        success_value=row.data.get("success_value"),
    )
    return TestSmsResponse(
        data=TestSmsResult(
            success=result.success,
            http_status=result.http_status,
            message=result.message,
        )
    )


@router.get("/sms-gateway/balance", response_model=SmsBalanceResponse)
async def get_sms_gateway_balance(db: AsyncSession = Depends(get_db)) -> SmsBalanceResponse:
    """Live account balance from the configured gateway's balance endpoint.
    Never raises for "not configured" or a provider-side failure — both
    come back as `success: false` with a `message`, so a page built on this
    can render a clear state instead of breaking."""
    row = await get_or_create_credential_row(db, SMS_GATEWAY_PROVIDER)
    balance_url = row.data.get("balance_url")
    api_key = row.data.get("api_key")
    sender_id = row.data.get("sender_id")
    if not balance_url or not api_key or not sender_id:
        return SmsBalanceResponse(
            data=SmsBalance(
                balance=None,
                success=False,
                http_status=0,
                message="No balance URL configured for this provider.",
            )
        )

    result = await get_balance(
        balance_url=balance_url,
        api_key=api_key,
        sender_id=sender_id,
        request_style=RequestStyle(row.data.get("request_style") or RequestStyle.GET_QUERY.value),
        api_key_field=row.data.get("api_key_field") or DEFAULT_API_KEY_FIELD,
        sender_id_field=row.data.get("sender_id_field") or DEFAULT_SENDER_ID_FIELD,
        success_field=row.data.get("success_field"),
        success_value=row.data.get("success_value"),
    )
    return SmsBalanceResponse(
        data=SmsBalance(
            balance=result.balance,
            success=result.success,
            http_status=result.http_status,
            message=result.message,
        )
    )
