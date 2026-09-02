from decimal import Decimal, InvalidOperation

from pydantic import BaseModel, Field, field_validator

from app.common.credentials import PlainFieldStatus, SecretFieldStatus
from app.common.sms_gateway_client import RequestStyle

DEFAULT_API_KEY_FIELD = "api_key"
DEFAULT_SENDER_ID_FIELD = "senderid"
DEFAULT_NUMBER_FIELD = "number"
DEFAULT_MESSAGE_FIELD = "message"


class SmsGatewayCredentialsStatus(BaseModel):
    api_url: PlainFieldStatus
    api_key: SecretFieldStatus
    sender_id: PlainFieldStatus
    rate_per_segment_bdt: PlainFieldStatus
    # Everything below lets this client speak an arbitrary provider's exact
    # request contract — see app.common.sms_gateway_client. All have
    # sensible defaults matching the common "GET + query string" convention
    # (e.g. bulksmsbd.net), so a simple gateway needs none of them touched.
    request_style: PlainFieldStatus
    api_key_field: PlainFieldStatus
    sender_id_field: PlainFieldStatus
    number_field: PlainFieldStatus
    message_field: PlainFieldStatus
    request_id_field: PlainFieldStatus
    success_field: PlainFieldStatus
    success_value: PlainFieldStatus
    # Optional — not every provider exposes a balance check. Reuses
    # request_style/api_key_field/sender_id_field/success_field/
    # success_value above; only the URL differs from send-SMS.
    balance_url: PlainFieldStatus


class SmsGatewayCredentialsResponse(BaseModel):
    success: bool = True
    data: SmsGatewayCredentialsStatus
    meta: dict = {}


class SmsGatewayCredentialsUpdate(BaseModel):
    """PATCH-style body — omitted fields are left unchanged; a field sent as
    blank/null clears it (and falls back to its default, if it has one).
    Not tied to any single SMS provider — see
    `app.common.sms_gateway_client` for what each field controls."""

    api_url: str | None = None
    api_key: str | None = None
    sender_id: str | None = None
    rate_per_segment_bdt: str | None = None
    request_style: RequestStyle | None = None
    api_key_field: str | None = None
    sender_id_field: str | None = None
    number_field: str | None = None
    message_field: str | None = None
    request_id_field: str | None = None
    success_field: str | None = None
    success_value: str | None = None
    balance_url: str | None = None

    @field_validator(
        "api_url",
        "api_key",
        "sender_id",
        "api_key_field",
        "sender_id_field",
        "number_field",
        "message_field",
        "request_id_field",
        "success_field",
        "success_value",
        "balance_url",
    )
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("api_url", "balance_url")
    @classmethod
    def _validate_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not (value.startswith("http://") or value.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return value

    @field_validator("rate_per_segment_bdt")
    @classmethod
    def _validate_rate(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            return None
        try:
            rate = Decimal(stripped)
        except InvalidOperation as exc:
            raise ValueError("Rate must be a valid number") from exc
        if rate < 0:
            raise ValueError("Rate must not be negative")
        return str(rate)


class TestSmsRequest(BaseModel):
    """A deliberate, one-off send to a single number the caller types in —
    never derived from stored customer data — so verifying the configured
    gateway's API key can never accidentally reach a real customer."""

    number: str = Field(min_length=1)
    message: str = Field(min_length=1, max_length=1600)


class TestSmsResult(BaseModel):
    success: bool
    http_status: int
    message: str


class TestSmsResponse(BaseModel):
    success: bool = True
    data: TestSmsResult
    meta: dict = {}


class SmsBalance(BaseModel):
    """`balance` is null when the provider call failed, or when it
    succeeded but returned a response shape this client doesn't recognize —
    never a guessed zero, since that would read as a real (and alarming)
    account balance."""

    balance: float | None
    success: bool
    http_status: int
    message: str


class SmsBalanceResponse(BaseModel):
    success: bool = True
    data: SmsBalance
    meta: dict = {}
