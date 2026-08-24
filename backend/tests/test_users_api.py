from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.role import Role
from app.models.user import User


async def _get_role(db_session: AsyncSession, name: str) -> Role:
    return (await db_session.execute(select(Role).where(Role.name == name))).scalar_one()


async def _create_user(
    db_session: AsyncSession, *, email: str, role_name: str, is_active: bool = True
) -> User:
    role = await _get_role(db_session, role_name)
    user = User(
        email=email,
        hashed_password=hash_password("some-password-123"),
        name="Test User",
        role_id=role.id,
        is_active=is_active,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def test_users_endpoint_rejects_role_without_users_manage(
    unauthenticated_client: AsyncClient, admin_user: User, db_session: AsyncSession
) -> None:
    staff = await _create_user(db_session, email="staff@topten.com.bd", role_name="Staff")
    token = create_access_token(user_public_id=str(staff.public_id))

    response = await unauthenticated_client.get(
        "/api/v1/users", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403


async def test_admin_can_list_users(client: AsyncClient, admin_user: User) -> None:
    response = await client.get("/api/v1/users")
    assert response.status_code == 200
    emails = [row["email"] for row in response.json()["data"]]
    assert admin_user.email in emails


async def test_admin_can_create_user(client: AsyncClient, db_session: AsyncSession) -> None:
    staff_role = await _get_role(db_session, "Staff")

    response = await client.post(
        "/api/v1/users",
        json={
            "email": "new.staff@topten.com.bd",
            "password": "a-strong-password",
            "name": "New Staff",
            "role_id": str(staff_role.public_id),
        },
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["email"] == "new.staff@topten.com.bd"
    assert data["role"]["name"] == "Staff"
    assert data["is_active"] is True


async def test_create_user_rejects_duplicate_email(
    client: AsyncClient, admin_user: User, db_session: AsyncSession
) -> None:
    staff_role = await _get_role(db_session, "Staff")

    response = await client.post(
        "/api/v1/users",
        json={
            "email": admin_user.email,
            "password": "a-strong-password",
            "name": "Duplicate",
            "role_id": str(staff_role.public_id),
        },
    )
    assert response.status_code == 422


async def test_patch_user_updates_fields(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _create_user(db_session, email="editme@topten.com.bd", role_name="Staff")

    response = await client.patch(
        f"/api/v1/users/{user.public_id}", json={"name": "Renamed", "is_active": False}
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["name"] == "Renamed"
    assert data["is_active"] is False


async def test_admin_cannot_deactivate_own_account(client: AsyncClient, admin_user: User) -> None:
    response = await client.patch(
        f"/api/v1/users/{admin_user.public_id}", json={"is_active": False}
    )
    assert response.status_code == 422


async def test_admin_cannot_delete_own_account(client: AsyncClient, admin_user: User) -> None:
    response = await client.delete(f"/api/v1/users/{admin_user.public_id}")
    assert response.status_code == 422


async def test_delete_user(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _create_user(db_session, email="deleteme@topten.com.bd", role_name="Staff")

    response = await client.delete(f"/api/v1/users/{user.public_id}")
    assert response.status_code == 204

    remaining = (
        await db_session.execute(select(User).where(User.public_id == user.public_id))
    ).scalar_one_or_none()
    assert remaining is None


async def test_list_roles_includes_seeded_roles_and_permissions(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/v1/roles")
    assert response.status_code == 200
    roles_by_name = {row["name"]: row for row in response.json()["data"]}
    assert set(roles_by_name) == {"Admin", "Manager", "Staff"}
    admin_permission_keys = {p["key"] for p in roles_by_name["Admin"]["permissions"]}
    assert "users.manage" in admin_permission_keys


async def test_update_role_permissions(client: AsyncClient, db_session: AsyncSession) -> None:
    staff_role = await _get_role(db_session, "Staff")

    response = await client.patch(
        f"/api/v1/roles/{staff_role.public_id}",
        json={"permission_keys": ["customers.view"]},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert [p["key"] for p in data["permissions"]] == ["customers.view"]


async def test_update_role_permissions_rejects_unknown_key(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    staff_role = await _get_role(db_session, "Staff")

    response = await client.patch(
        f"/api/v1/roles/{staff_role.public_id}",
        json={"permission_keys": ["not-a-real-permission"]},
    )
    assert response.status_code == 422
