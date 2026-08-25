from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.gift_catalog_item import GiftCatalogItem
from app.models.role import Role
from app.models.user import User


async def _get_role(db_session: AsyncSession, name: str) -> Role:
    return (await db_session.execute(select(Role).where(Role.name == name))).scalar_one()


async def _create_user(db_session: AsyncSession, *, email: str, role_name: str) -> User:
    role = await _get_role(db_session, role_name)
    user = User(
        email=email, hashed_password=hash_password("some-password-123"),
        name="Test User", role_id=role.id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def _add_catalog_item(
    db_session: AsyncSession, *, name: str = "Test Gift", stock_quantity: int = 10
) -> GiftCatalogItem:
    item = GiftCatalogItem(
        name=name,
        category="FOOD_AND_BEVERAGE",
        description="A test gift",
        points_cost=100,
        retail_value="500.00",
        stock_quantity=stock_quantity,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


async def test_admin_can_create_catalog_item(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/gifts/catalog",
        json={
            "name": "Fancy Mug",
            "category": "HOME_AND_LIVING",
            "description": "A ceramic mug",
            "points_cost": 300,
            "retail_value": "450.00",
            "stock_quantity": 20,
        },
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == "Fancy Mug"
    assert data["stock_status"] == "IN_STOCK"
    assert data["times_redeemed"] == 0


async def test_stock_status_is_derived(client: AsyncClient, db_session: AsyncSession) -> None:
    out_of_stock = await _add_catalog_item(db_session, name="Out", stock_quantity=0)
    low_stock = await _add_catalog_item(db_session, name="Low", stock_quantity=5)
    in_stock = await _add_catalog_item(db_session, name="Plenty", stock_quantity=50)

    response = await client.get("/api/v1/gifts/catalog")
    by_name = {row["name"]: row["stock_status"] for row in response.json()["data"]}
    assert by_name[out_of_stock.name] == "OUT_OF_STOCK"
    assert by_name[low_stock.name] == "LOW_STOCK"
    assert by_name[in_stock.name] == "IN_STOCK"


async def test_admin_can_update_catalog_item(client: AsyncClient, db_session: AsyncSession) -> None:
    item = await _add_catalog_item(db_session)

    response = await client.patch(
        f"/api/v1/gifts/catalog/{item.public_id}",
        json={"stock_quantity": 3, "points_cost": 999},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["stock_quantity"] == 3
    assert data["points_cost"] == 999
    assert data["stock_status"] == "LOW_STOCK"


async def test_admin_can_delete_catalog_item(client: AsyncClient, db_session: AsyncSession) -> None:
    item = await _add_catalog_item(db_session)

    response = await client.delete(f"/api/v1/gifts/catalog/{item.public_id}")
    assert response.status_code == 204

    remaining = (
        await db_session.execute(
            select(GiftCatalogItem).where(GiftCatalogItem.public_id == item.public_id)
        )
    ).scalar_one_or_none()
    assert remaining is None


async def test_staff_can_view_but_not_manage_catalog(
    unauthenticated_client: AsyncClient, admin_user: User, db_session: AsyncSession
) -> None:
    staff = await _create_user(db_session, email="staff.gifts@topten.com.bd", role_name="Staff")
    token = create_access_token(user_public_id=str(staff.public_id))
    headers = {"Authorization": f"Bearer {token}"}

    list_response = await unauthenticated_client.get("/api/v1/gifts/catalog", headers=headers)
    assert list_response.status_code == 200

    create_response = await unauthenticated_client.post(
        "/api/v1/gifts/catalog",
        headers=headers,
        json={
            "name": "Nope",
            "category": "ELECTRONICS",
            "points_cost": 100,
            "retail_value": "100.00",
        },
    )
    assert create_response.status_code == 403


async def test_gift_stats_reflects_catalog_count(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _add_catalog_item(db_session, name="Stat Gift")

    response = await client.get("/api/v1/gifts/stats")
    assert response.status_code == 200
    assert response.json()["data"]["total_gifts_in_catalog"] >= 1
