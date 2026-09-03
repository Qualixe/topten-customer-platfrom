"""GET/POST /api/v1/customers/types, PATCH /api/v1/customers/types/{id}.

Mirrors test_gifts_catalog_api.py's category CRUD coverage, except there is
no delete here — only an `is_active` toggle (see app.services.customer_types)
— plus one extra rule GiftCategory doesn't have: the three `is_system` rows
(General/VIP/VVIP, seeded when this table replaced the old fixed
CustomerType enum) can never be renamed or deactivated.
"""

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.customer_type import CustomerType
from app.models.role import Role
from app.models.user import User
from tests.support import get_or_create_customer_type


async def _add_system_type(db_session: AsyncSession, *, name: str) -> CustomerType:
    """A self-contained `is_system=True` row — deliberately NOT relying on
    the migration-seeded General/VIP/VVIP rows surviving, since another
    test (test_database_reset_api.py) legitimately wipes `customer_types`
    via the real reset endpoint and nothing re-seeds it afterward (same
    "fresh install" tradeoff already accepted for gift_categories)."""
    system_type = CustomerType(name=name, is_system=True)
    db_session.add(system_type)
    await db_session.commit()
    await db_session.refresh(system_type)
    return system_type


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


async def test_list_customer_types_includes_the_three_seeded_ones(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/v1/customers/types")
    assert response.status_code == 200
    names = {row["name"] for row in response.json()["data"]}
    assert {"General", "VIP", "VVIP"} <= names


async def test_admin_can_create_customer_type(client: AsyncClient) -> None:
    response = await client.post("/api/v1/customers/types", json={"name": "Platinum"})
    assert response.status_code == 201
    body = response.json()["data"]
    assert body["name"] == "Platinum"
    assert body["is_system"] is False


async def test_cannot_create_duplicate_customer_type(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await get_or_create_customer_type(db_session, "Platinum")

    response = await client.post("/api/v1/customers/types", json={"name": "Platinum"})
    assert response.status_code == 422


async def test_admin_can_rename_a_custom_type(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    custom = await get_or_create_customer_type(db_session, "Old Name")

    response = await client.patch(
        f"/api/v1/customers/types/{custom.public_id}", json={"name": "New Name"}
    )
    assert response.status_code == 200
    assert response.json()["data"]["name"] == "New Name"


async def test_cannot_rename_a_system_type(client: AsyncClient, db_session: AsyncSession) -> None:
    system_type = await _add_system_type(db_session, name="System Type A")

    response = await client.patch(
        f"/api/v1/customers/types/{system_type.public_id}", json={"name": "Renamed"}
    )
    assert response.status_code == 422


async def test_new_customer_types_default_to_active(client: AsyncClient) -> None:
    response = await client.post("/api/v1/customers/types", json={"name": "Platinum Plus"})
    assert response.status_code == 201
    assert response.json()["data"]["is_active"] is True


async def test_admin_can_deactivate_and_reactivate_a_custom_type(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    custom = await get_or_create_customer_type(db_session, "Seasonal")

    response = await client.patch(
        f"/api/v1/customers/types/{custom.public_id}", json={"is_active": False}
    )
    assert response.status_code == 200
    assert response.json()["data"]["is_active"] is False

    response = await client.patch(
        f"/api/v1/customers/types/{custom.public_id}", json={"is_active": True}
    )
    assert response.status_code == 200
    assert response.json()["data"]["is_active"] is True


async def test_cannot_deactivate_a_system_type(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    system_type = await _add_system_type(db_session, name="System Type B")

    response = await client.patch(
        f"/api/v1/customers/types/{system_type.public_id}", json={"is_active": False}
    )
    assert response.status_code == 422


async def test_no_delete_route_for_customer_types(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    custom = await get_or_create_customer_type(db_session, "No Delete")

    response = await client.delete(f"/api/v1/customers/types/{custom.public_id}")
    assert response.status_code == 405


async def test_staff_cannot_manage_customer_types(
    unauthenticated_client: AsyncClient, admin_user: User, db_session: AsyncSession
) -> None:
    staff = await _create_user(
        db_session, email="staff.customer-types@topten.com.bd", role_name="Staff"
    )
    token = create_access_token(user_public_id=str(staff.public_id))
    headers = {"Authorization": f"Bearer {token}"}

    response = await unauthenticated_client.post(
        "/api/v1/customers/types", headers=headers, json={"name": "Nope"}
    )
    assert response.status_code == 403


async def test_staff_can_view_customer_types(
    unauthenticated_client: AsyncClient, admin_user: User, db_session: AsyncSession
) -> None:
    staff = await _create_user(
        db_session, email="staff.customer-types-view@topten.com.bd", role_name="Staff"
    )
    token = create_access_token(user_public_id=str(staff.public_id))
    headers = {"Authorization": f"Bearer {token}"}

    response = await unauthenticated_client.get(
        "/api/v1/customers/types", headers=headers
    )
    assert response.status_code == 200
