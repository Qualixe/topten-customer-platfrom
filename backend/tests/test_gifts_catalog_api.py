import uuid

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.gift_catalog_item import GiftCatalogItem
from app.models.gift_category import GiftCategory
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


async def _add_category(db_session: AsyncSession, *, name: str = "Food & Beverage") -> GiftCategory:
    category = GiftCategory(name=name)
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)
    return category


async def _add_catalog_item(
    db_session: AsyncSession,
    *,
    name: str = "Test Gift",
    stock_quantity: int = 10,
    category: GiftCategory | None = None,
) -> GiftCatalogItem:
    if category is None:
        category = await _add_category(db_session, name=f"Category for {name}")

    item = GiftCatalogItem(
        name=name,
        category_id=category.id,
        description="A test gift",
        points_cost=100,
        retail_value="500.00",
        stock_quantity=stock_quantity,
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


async def test_admin_can_create_catalog_item(client: AsyncClient, db_session: AsyncSession) -> None:
    category = await _add_category(db_session, name="Home & Living")

    response = await client.post(
        "/api/v1/gifts/catalog",
        json={
            "name": "Fancy Mug",
            "category_id": str(category.public_id),
            "description": "A ceramic mug",
            "points_cost": 300,
            "retail_value": "450.00",
            "stock_quantity": 20,
        },
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == "Fancy Mug"
    assert data["category"]["name"] == "Home & Living"
    assert data["stock_status"] == "IN_STOCK"
    assert data["times_redeemed"] == 0


async def test_stock_status_is_derived(client: AsyncClient, db_session: AsyncSession) -> None:
    category = await _add_category(db_session)
    out_of_stock = await _add_catalog_item(
        db_session, name="Out", stock_quantity=0, category=category
    )
    low_stock = await _add_catalog_item(
        db_session, name="Low", stock_quantity=5, category=category
    )
    in_stock = await _add_catalog_item(
        db_session, name="Plenty", stock_quantity=50, category=category
    )

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


async def test_admin_can_change_catalog_item_category(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    original = await _add_category(db_session, name="Original")
    new_category = await _add_category(db_session, name="New Category")
    item = await _add_catalog_item(db_session, category=original)

    response = await client.patch(
        f"/api/v1/gifts/catalog/{item.public_id}",
        json={"category_id": str(new_category.public_id)},
    )
    assert response.status_code == 200
    assert response.json()["data"]["category"]["name"] == "New Category"


async def test_admin_can_get_a_single_catalog_item(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    item = await _add_catalog_item(db_session, name="Fetch Me")

    response = await client.get(f"/api/v1/gifts/catalog/{item.public_id}")
    assert response.status_code == 200
    assert response.json()["data"]["name"] == "Fetch Me"


async def test_get_catalog_item_404s_for_an_unknown_id(client: AsyncClient) -> None:
    response = await client.get(f"/api/v1/gifts/catalog/{uuid.uuid4()}")
    assert response.status_code == 404


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
    category = await _add_category(db_session)

    list_response = await unauthenticated_client.get("/api/v1/gifts/catalog", headers=headers)
    assert list_response.status_code == 200

    create_response = await unauthenticated_client.post(
        "/api/v1/gifts/catalog",
        headers=headers,
        json={
            "name": "Nope",
            "category_id": str(category.public_id),
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


async def test_list_categories(client: AsyncClient, db_session: AsyncSession) -> None:
    await _add_category(db_session, name="Zebra")
    await _add_category(db_session, name="Alpha")

    response = await client.get("/api/v1/gifts/categories")
    assert response.status_code == 200
    names = [row["name"] for row in response.json()["data"]]
    # Sorted by name.
    assert names.index("Alpha") < names.index("Zebra")


async def test_admin_can_create_category(client: AsyncClient) -> None:
    response = await client.post("/api/v1/gifts/categories", json={"name": "Stationery"})
    assert response.status_code == 201
    assert response.json()["data"]["name"] == "Stationery"


async def test_cannot_create_duplicate_category(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _add_category(db_session, name="Books")

    response = await client.post("/api/v1/gifts/categories", json={"name": "Books"})
    assert response.status_code == 422


async def test_admin_can_rename_category(client: AsyncClient, db_session: AsyncSession) -> None:
    category = await _add_category(db_session, name="Old Name")

    response = await client.patch(
        f"/api/v1/gifts/categories/{category.public_id}", json={"name": "New Name"}
    )
    assert response.status_code == 200
    assert response.json()["data"]["name"] == "New Name"


async def test_admin_can_delete_an_unused_category(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    category = await _add_category(db_session, name="Unused")

    response = await client.delete(f"/api/v1/gifts/categories/{category.public_id}")
    assert response.status_code == 204


async def test_cannot_delete_a_category_in_use(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    category = await _add_category(db_session, name="In Use")
    await _add_catalog_item(db_session, category=category)

    response = await client.delete(f"/api/v1/gifts/categories/{category.public_id}")
    assert response.status_code == 422


async def test_staff_cannot_manage_categories(
    unauthenticated_client: AsyncClient, admin_user: User, db_session: AsyncSession
) -> None:
    staff = await _create_user(
        db_session, email="staff.categories@topten.com.bd", role_name="Staff"
    )
    token = create_access_token(user_public_id=str(staff.public_id))
    headers = {"Authorization": f"Bearer {token}"}

    response = await unauthenticated_client.post(
        "/api/v1/gifts/categories", headers=headers, json={"name": "Nope"}
    )
    assert response.status_code == 403
