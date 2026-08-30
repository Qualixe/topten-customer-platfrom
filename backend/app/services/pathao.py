"""Token caching and order dispatch for the real Pathao Courier API —
separate from `app.services.deliveries`, which owns the `Delivery` model
itself and stays courier-agnostic (Pathao is just one of several couriers
that can be logged there manually)."""

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.common import pathao_client
from app.common.credentials import get_or_create_credential_row, merge_credential_data
from app.common.exceptions import ValidationAppError

PATHAO_PROVIDER = "pathao"


def _to_local_phone(phone: str) -> str:
    """Pathao rejects E.164 (`+8801XXXXXXXXX`, what this app stores for
    customers) and requires the local dial format (`01XXXXXXXXX`) instead —
    confirmed by a real "not a valid phone number" rejection from Pathao's
    API for the E.164 form of an otherwise-valid Bangladeshi mobile number."""
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits.startswith("880"):
        digits = digits[3:]
    if not digits.startswith("0"):
        digits = f"0{digits}"
    return digits

# Refresh a bit before Pathao's own expiry so an in-flight request never
# gets a token that dies mid-call.
_TOKEN_REFRESH_MARGIN = timedelta(minutes=5)


def _sandbox_mode(data: dict) -> bool:
    # Defaults to sandbox — a freshly-saved set of credentials shouldn't be
    # able to create a real shipment until someone deliberately flips this.
    return bool(data.get("sandbox", True))


async def get_pathao_access_token(db: AsyncSession) -> str:
    row = await get_or_create_credential_row(db, PATHAO_PROVIDER)
    data = row.data

    cached_token = data.get("access_token")
    expires_at_raw = data.get("token_expires_at")
    if cached_token and expires_at_raw:
        expires_at = datetime.fromisoformat(expires_at_raw)
        if expires_at > datetime.now(UTC) + _TOKEN_REFRESH_MARGIN:
            return cached_token

    client_id = data.get("client_id")
    client_secret = data.get("client_secret")
    username = data.get("username")
    password = data.get("password")
    if not all([client_id, client_secret, username, password]):
        raise ValidationAppError(
            "Save your Pathao Client ID, Client Secret, Username, and Password in "
            "Settings → Couriers before dispatching a delivery."
        )

    try:
        token = await pathao_client.issue_token(
            client_id=client_id,
            client_secret=client_secret,
            username=username,
            password=password,
            sandbox=_sandbox_mode(data),
        )
    except pathao_client.PathaoApiError as exc:
        raise ValidationAppError(f"Pathao rejected these credentials: {exc}") from exc

    expires_at = datetime.now(UTC) + timedelta(seconds=token.expires_in)
    await merge_credential_data(
        db,
        PATHAO_PROVIDER,
        {"access_token": token.access_token, "token_expires_at": expires_at.isoformat()},
    )
    return token.access_token


async def list_pathao_stores(db: AsyncSession) -> list[pathao_client.PathaoLocation]:
    row = await get_or_create_credential_row(db, PATHAO_PROVIDER)
    token = await get_pathao_access_token(db)
    try:
        return await pathao_client.list_stores(access_token=token, sandbox=_sandbox_mode(row.data))
    except pathao_client.PathaoApiError as exc:
        raise ValidationAppError(f"Pathao couldn't list stores: {exc}") from exc


async def list_pathao_cities(db: AsyncSession) -> list[pathao_client.PathaoLocation]:
    row = await get_or_create_credential_row(db, PATHAO_PROVIDER)
    token = await get_pathao_access_token(db)
    try:
        return await pathao_client.list_cities(access_token=token, sandbox=_sandbox_mode(row.data))
    except pathao_client.PathaoApiError as exc:
        raise ValidationAppError(f"Pathao couldn't list cities: {exc}") from exc


async def list_pathao_zones(db: AsyncSession, city_id: int) -> list[pathao_client.PathaoLocation]:
    row = await get_or_create_credential_row(db, PATHAO_PROVIDER)
    token = await get_pathao_access_token(db)
    try:
        return await pathao_client.list_zones(
            access_token=token, sandbox=_sandbox_mode(row.data), city_id=city_id
        )
    except pathao_client.PathaoApiError as exc:
        raise ValidationAppError(f"Pathao couldn't list zones: {exc}") from exc


async def list_pathao_areas(db: AsyncSession, zone_id: int) -> list[pathao_client.PathaoLocation]:
    row = await get_or_create_credential_row(db, PATHAO_PROVIDER)
    token = await get_pathao_access_token(db)
    try:
        return await pathao_client.list_areas(
            access_token=token, sandbox=_sandbox_mode(row.data), zone_id=zone_id
        )
    except pathao_client.PathaoApiError as exc:
        raise ValidationAppError(f"Pathao couldn't list areas: {exc}") from exc


async def dispatch_pathao_order(
    db: AsyncSession,
    *,
    recipient_name: str,
    recipient_phone: str,
    recipient_address: str,
    city_id: int,
    zone_id: int,
    area_id: int,
    merchant_order_id: str,
    item_description: str,
) -> pathao_client.PathaoOrderResult:
    row = await get_or_create_credential_row(db, PATHAO_PROVIDER)
    store_id_raw = row.data.get("store_id")
    if not store_id_raw:
        raise ValidationAppError(
            "Set a Pathao Store ID in Settings → Couriers before dispatching a delivery."
        )

    token = await get_pathao_access_token(db)
    try:
        return await pathao_client.create_order(
            access_token=token,
            sandbox=_sandbox_mode(row.data),
            store_id=int(store_id_raw),
            merchant_order_id=merchant_order_id,
            recipient_name=recipient_name,
            recipient_phone=_to_local_phone(recipient_phone),
            recipient_address=recipient_address,
            recipient_city=city_id,
            recipient_zone=zone_id,
            recipient_area=area_id,
            item_description=item_description,
        )
    except pathao_client.PathaoApiError as exc:
        raise ValidationAppError(f"Pathao couldn't create this shipment: {exc}") from exc
