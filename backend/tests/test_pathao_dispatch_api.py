"""Real Pathao dispatch — GET /couriers/pathao/{stores,cities,...} and the
live-dispatch path of POST /couriers/deliveries. `app.common.pathao_client`
is mocked throughout; nothing here makes a real network call.
"""

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import merge_credential_data
from app.common.pathao_client import PathaoApiError, PathaoLocation, PathaoOrderResult, PathaoToken
from app.models.customer import Customer
from app.models.gift_catalog_item import GiftCatalogItem
from app.models.gift_category import GiftCategory
from app.models.gift_order import GiftOrder
from app.services.pathao import PATHAO_PROVIDER
from tests.support import get_customer_type_id


async def _save_pathao_credentials(db_session: AsyncSession, **overrides) -> None:
    data = {
        "client_id": "client-123",
        "client_secret": "secret-abc",
        "username": "store@topten.com.bd",
        "password": "hunter2",
        "store_id": "401253",
        "sandbox": True,
    }
    data.update(overrides)
    await merge_credential_data(db_session, PATHAO_PROVIDER, data)


async def _add_customer(db_session: AsyncSession, *, name: str = "Rahim Uddin") -> Customer:
    customer = Customer(
        name=name,
        phone="+8801711000101",
        normalized_phone="+8801711000101",
        customer_type_id=await get_customer_type_id(db_session),
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer


async def _add_catalog_item(db_session: AsyncSession) -> GiftCatalogItem:
    category = GiftCategory(name="Pathao Test Category")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    item = GiftCatalogItem(
        name="Test Gift",
        category_id=category.id,
        description="",
        retail_value="500.00",
        stock_quantity=5,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


async def _add_gift_order(db_session: AsyncSession) -> GiftOrder:
    customer = await _add_customer(db_session)
    item = await _add_catalog_item(db_session)
    order = GiftOrder(
        customer_id=customer.id, catalog_item_id=item.id, gift_name=item.name, occasion="BIRTHDAY"
    )
    db_session.add(order)
    await db_session.commit()
    await db_session.refresh(order)
    return order


MOCK_TOKEN = PathaoToken(access_token="mock-token", expires_in=7776000)


async def test_pathao_cities_requires_saved_credentials(client: AsyncClient) -> None:
    response = await client.get("/api/v1/couriers/pathao/cities")
    assert response.status_code == 422
    assert "Settings" in response.json()["detail"]


async def test_pathao_cities_returns_live_list(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _save_pathao_credentials(db_session)

    with (
        patch("app.common.pathao_client.issue_token", new=AsyncMock(return_value=MOCK_TOKEN)),
        patch(
            "app.common.pathao_client.list_cities",
            new=AsyncMock(return_value=[PathaoLocation(id=1, name="Dhaka")]),
        ),
    ):
        response = await client.get("/api/v1/couriers/pathao/cities")

    assert response.status_code == 200
    assert response.json()["data"] == [{"id": 1, "name": "Dhaka"}]


async def test_pathao_cities_surfaces_pathao_api_error_as_422(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """A real Pathao API failure (e.g. wrong sandbox/production credentials)
    must come back as a clear 422, not bubble up as an unhandled 500."""
    await _save_pathao_credentials(db_session)

    with (
        patch("app.common.pathao_client.issue_token", new=AsyncMock(return_value=MOCK_TOKEN)),
        patch(
            "app.common.pathao_client.list_cities",
            new=AsyncMock(side_effect=PathaoApiError("Unauthorized User")),
        ),
    ):
        response = await client.get("/api/v1/couriers/pathao/cities")

    assert response.status_code == 422
    assert "Unauthorized User" in response.json()["detail"]


async def test_pathao_zones_and_areas_use_path_params(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _save_pathao_credentials(db_session)

    with (
        patch("app.common.pathao_client.issue_token", new=AsyncMock(return_value=MOCK_TOKEN)),
        patch(
            "app.common.pathao_client.list_zones",
            new=AsyncMock(return_value=[PathaoLocation(id=20, name="Mirpur")]),
        ) as mock_zones,
    ):
        response = await client.get("/api/v1/couriers/pathao/cities/1/zones")
    assert response.status_code == 200
    assert response.json()["data"] == [{"id": 20, "name": "Mirpur"}]
    assert mock_zones.call_args.kwargs["city_id"] == 1

    with (
        patch("app.common.pathao_client.issue_token", new=AsyncMock(return_value=MOCK_TOKEN)),
        patch(
            "app.common.pathao_client.list_areas",
            new=AsyncMock(return_value=[PathaoLocation(id=100, name="Section 11")]),
        ) as mock_areas,
    ):
        response = await client.get("/api/v1/couriers/pathao/zones/20/areas")
    assert response.status_code == 200
    assert response.json()["data"] == [{"id": 100, "name": "Section 11"}]
    assert mock_areas.call_args.kwargs["zone_id"] == 20


async def test_create_delivery_with_tracking_number_never_calls_pathao(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """The manual-entry path (existing behaviour) must not touch Pathao's
    API at all, even when the courier is Pathao and credentials exist."""
    await _save_pathao_credentials(db_session)
    order = await _add_gift_order(db_session)

    with patch("app.common.pathao_client.issue_token", new=AsyncMock()) as mock_issue:
        response = await client.post(
            "/api/v1/couriers/deliveries",
            json={
                "gift_order_id": str(order.public_id),
                "courier": "PATHAO",
                "tracking_number": "PTH-MANUAL-1",
                "address": "House 1",
                "city": "Dhaka",
            },
        )

    assert response.status_code == 201
    assert response.json()["data"]["tracking_number"] == "PTH-MANUAL-1"
    mock_issue.assert_not_called()


async def test_create_delivery_dispatches_live_via_pathao(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _save_pathao_credentials(db_session)
    order = await _add_gift_order(db_session)

    mock_result = PathaoOrderResult(
        consignment_id="DZ010523G674QD", order_status="Pending", delivery_fee=70
    )
    with (
        patch("app.common.pathao_client.issue_token", new=AsyncMock(return_value=MOCK_TOKEN)),
        patch(
            "app.common.pathao_client.create_order", new=AsyncMock(return_value=mock_result)
        ) as mock_create,
    ):
        response = await client.post(
            "/api/v1/couriers/deliveries",
            json={
                "gift_order_id": str(order.public_id),
                "courier": "PATHAO",
                "address": "House 6, Block A, Road 3, Mirpur 11",
                "city": "Dhaka - Mirpur",
                "pathao_city_id": 1,
                "pathao_zone_id": 20,
                "pathao_area_id": 100,
                "recipient_name": "Rahim Uddin",
                "recipient_phone": "+8801711000101",
            },
        )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["tracking_number"] == "DZ010523G674QD"
    assert data["courier"] == "PATHAO"

    _, kwargs = mock_create.call_args
    assert kwargs["store_id"] == 401253
    assert kwargs["recipient_city"] == 1
    assert kwargs["recipient_zone"] == 20
    assert kwargs["recipient_area"] == 100
    # Pathao rejects E.164 (+8801XXXXXXXXX, what this app stores) and
    # requires the local dial format instead — confirmed against Pathao's
    # real API, which rejected the E.164 form as "not a valid phone number".
    assert kwargs["recipient_phone"] == "01711000101"
    assert kwargs["merchant_order_id"] == str(order.public_id)


async def test_create_delivery_requires_tracking_or_pathao_fields(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    order = await _add_gift_order(db_session)

    response = await client.post(
        "/api/v1/couriers/deliveries",
        json={
            "gift_order_id": str(order.public_id),
            "courier": "PATHAO",
            "address": "House 1",
            "city": "Dhaka",
        },
    )
    assert response.status_code == 422


async def test_create_delivery_pathao_dispatch_requires_recipient_contact(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    order = await _add_gift_order(db_session)

    response = await client.post(
        "/api/v1/couriers/deliveries",
        json={
            "gift_order_id": str(order.public_id),
            "courier": "PATHAO",
            "address": "House 1",
            "city": "Dhaka",
            "pathao_city_id": 1,
            "pathao_zone_id": 20,
            "pathao_area_id": 100,
        },
    )
    assert response.status_code == 422


async def test_create_delivery_pathao_dispatch_rejected_for_other_couriers(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    order = await _add_gift_order(db_session)

    response = await client.post(
        "/api/v1/couriers/deliveries",
        json={
            "gift_order_id": str(order.public_id),
            "courier": "REDX",
            "address": "House 1",
            "city": "Dhaka",
            "pathao_city_id": 1,
            "pathao_zone_id": 20,
            "pathao_area_id": 100,
            "recipient_name": "Rahim Uddin",
            "recipient_phone": "+8801711000101",
        },
    )
    assert response.status_code == 422


async def test_create_delivery_surfaces_pathao_api_error(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _save_pathao_credentials(db_session)
    order = await _add_gift_order(db_session)

    with (
        patch("app.common.pathao_client.issue_token", new=AsyncMock(return_value=MOCK_TOKEN)),
        patch(
            "app.common.pathao_client.create_order",
            new=AsyncMock(side_effect=PathaoApiError("Invalid recipient_phone")),
        ),
    ):
        response = await client.post(
            "/api/v1/couriers/deliveries",
            json={
                "gift_order_id": str(order.public_id),
                "courier": "PATHAO",
                "address": "House 1",
                "city": "Dhaka",
                "pathao_city_id": 1,
                "pathao_zone_id": 20,
                "pathao_area_id": 100,
                "recipient_name": "Rahim Uddin",
                "recipient_phone": "bad-phone",
            },
        )

    assert response.status_code == 422
    assert "Invalid recipient_phone" in response.json()["detail"]


def test_to_local_phone_normalizes_e164_to_local_dial_format() -> None:
    from app.services.pathao import _to_local_phone

    assert _to_local_phone("+8801711000101") == "01711000101"
    assert _to_local_phone("8801711000101") == "01711000101"
    assert _to_local_phone("01711000101") == "01711000101"


async def test_pathao_token_is_cached_and_reused(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _save_pathao_credentials(db_session)

    with (
        patch(
            "app.common.pathao_client.issue_token", new=AsyncMock(return_value=MOCK_TOKEN)
        ) as mock_issue,
        patch("app.common.pathao_client.list_cities", new=AsyncMock(return_value=[])),
    ):
        await client.get("/api/v1/couriers/pathao/cities")
        await client.get("/api/v1/couriers/pathao/cities")

    # Two requests, but only one real token exchange — the second reuses
    # the cached (still-valid) access token from credential storage.
    assert mock_issue.call_count == 1
