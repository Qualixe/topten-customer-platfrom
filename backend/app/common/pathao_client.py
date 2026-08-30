"""Thin async client for Pathao's Courier ("Aladdin") merchant API.

Base URLs, endpoint paths, and field names below are verified against a
real call made against the production API during development (not just
Pathao's own docs, which are gated behind a merchant login) — see the
response shapes noted on each function.
"""

import httpx
from pydantic import BaseModel

SANDBOX_BASE_URL = "https://courier-api-sandbox.pathao.com"
PRODUCTION_BASE_URL = "https://api-hermes.pathao.com"

_TIMEOUT = 20.0


class PathaoApiError(Exception):
    """Pathao's API was reached but responded with an error (bad
    credentials, validation failure, etc.) — message is Pathao's own."""


class PathaoToken(BaseModel):
    access_token: str
    expires_in: int


class PathaoLocation(BaseModel):
    id: int
    name: str


class PathaoOrderResult(BaseModel):
    consignment_id: str
    order_status: str
    delivery_fee: float | None = None


def _base_url(sandbox: bool) -> str:
    return SANDBOX_BASE_URL if sandbox else PRODUCTION_BASE_URL


def _raise_for_error(response: httpx.Response) -> None:
    if response.status_code < 400:
        return
    try:
        body = response.json()
    except ValueError:
        raise PathaoApiError(response.text[:500]) from None

    message = body.get("message") or response.text
    # Validation failures (422s) carry the useful detail in a Laravel-style
    # `errors: {field: [messages]}` map, not `message` — which is just a
    # generic "Please fix the given errors" otherwise.
    errors = body.get("errors")
    if isinstance(errors, dict) and errors:
        details = "; ".join(
            f"{field}: {', '.join(msgs) if isinstance(msgs, list) else msgs}"
            for field, msgs in errors.items()
        )
        message = f"{message} ({details})"
    raise PathaoApiError(f"{message}"[:500])


async def issue_token(
    *, client_id: str, client_secret: str, username: str, password: str, sandbox: bool
) -> PathaoToken:
    """POST /aladdin/api/v1/issue-token — response: {token_type,
    expires_in, access_token}. No refresh_token is issued; re-authenticate
    with the same credentials once the token expires."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.post(
            f"{_base_url(sandbox)}/aladdin/api/v1/issue-token",
            json={
                "client_id": client_id,
                "client_secret": client_secret,
                "username": username,
                "password": password,
                "grant_type": "password",
            },
        )
    _raise_for_error(response)
    body = response.json()
    return PathaoToken(access_token=body["access_token"], expires_in=body["expires_in"])


async def _get_locations(
    path: str, *, access_token: str, sandbox: bool, id_key: str, name_key: str
) -> list[PathaoLocation]:
    """List endpoints all share the same envelope:
    {message, type, code, data: {data: [...], total, ...}}."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.get(
            f"{_base_url(sandbox)}{path}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    _raise_for_error(response)
    rows = response.json().get("data", {}).get("data", [])
    return [PathaoLocation(id=row[id_key], name=row[name_key]) for row in rows]


async def list_stores(*, access_token: str, sandbox: bool) -> list[PathaoLocation]:
    return await _get_locations(
        "/aladdin/api/v1/stores",
        access_token=access_token,
        sandbox=sandbox,
        id_key="store_id",
        name_key="store_name",
    )


async def list_cities(*, access_token: str, sandbox: bool) -> list[PathaoLocation]:
    return await _get_locations(
        "/aladdin/api/v1/countries/1/city-list",
        access_token=access_token,
        sandbox=sandbox,
        id_key="city_id",
        name_key="city_name",
    )


async def list_zones(*, access_token: str, sandbox: bool, city_id: int) -> list[PathaoLocation]:
    return await _get_locations(
        f"/aladdin/api/v1/cities/{city_id}/zone-list",
        access_token=access_token,
        sandbox=sandbox,
        id_key="zone_id",
        name_key="zone_name",
    )


async def list_areas(*, access_token: str, sandbox: bool, zone_id: int) -> list[PathaoLocation]:
    return await _get_locations(
        f"/aladdin/api/v1/zones/{zone_id}/area-list",
        access_token=access_token,
        sandbox=sandbox,
        id_key="area_id",
        name_key="area_name",
    )


# Pathao's own fixed vocabulary — 48 = Normal Delivery (the only kind this
# app ever books; 12 = "On Demand" isn't offered here), 2 = Parcel (1 would
# be Document, never applicable to a gift).
NORMAL_DELIVERY_TYPE = 48
PARCEL_ITEM_TYPE = 2


async def create_order(
    *,
    access_token: str,
    sandbox: bool,
    store_id: int,
    merchant_order_id: str,
    recipient_name: str,
    recipient_phone: str,
    recipient_address: str,
    recipient_city: int,
    recipient_zone: int,
    recipient_area: int,
    item_description: str,
    special_instruction: str | None = None,
    item_quantity: int = 1,
    item_weight: float = 0.5,
    amount_to_collect: int = 0,
) -> PathaoOrderResult:
    """POST /aladdin/api/v1/orders — response `data`: {consignment_id,
    order_status, delivery_fee, ...}. `consignment_id` is Pathao's real
    tracking number."""
    payload = {
        "store_id": store_id,
        "merchant_order_id": merchant_order_id,
        "recipient_name": recipient_name,
        "recipient_phone": recipient_phone,
        "recipient_address": recipient_address,
        "recipient_city": recipient_city,
        "recipient_zone": recipient_zone,
        "recipient_area": recipient_area,
        "delivery_type": NORMAL_DELIVERY_TYPE,
        "item_type": PARCEL_ITEM_TYPE,
        "special_instruction": special_instruction or "",
        "item_quantity": item_quantity,
        "item_weight": item_weight,
        "amount_to_collect": amount_to_collect,
        "item_description": item_description,
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.post(
            f"{_base_url(sandbox)}/aladdin/api/v1/orders",
            json=payload,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    _raise_for_error(response)
    body = response.json().get("data", {})
    return PathaoOrderResult(
        consignment_id=body["consignment_id"],
        order_status=body.get("order_status", "Pending"),
        delivery_fee=body.get("delivery_fee"),
    )
