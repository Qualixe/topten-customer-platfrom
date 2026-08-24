from datetime import UTC, datetime, timedelta

import jwt
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import JWT_ALGORITHM, create_access_token
from app.models.user import User


async def test_login_with_correct_credentials_returns_token_and_user(
    unauthenticated_client: AsyncClient, admin_user: User
) -> None:
    response = await unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"email": admin_user.email, "password": settings.INITIAL_ADMIN_PASSWORD},
    )
    assert response.status_code == 200

    data = response.json()["data"]
    assert data["token"]
    assert data["user"]["email"] == admin_user.email
    assert data["user"]["role"] == "Admin"
    assert "users.manage" in data["user"]["permissions"]


async def test_login_with_wrong_password_returns_401(
    unauthenticated_client: AsyncClient, admin_user: User
) -> None:
    response = await unauthenticated_client.post(
        "/api/v1/auth/login", json={"email": admin_user.email, "password": "wrong-password"}
    )
    assert response.status_code == 401


async def test_login_with_unknown_email_returns_401(unauthenticated_client: AsyncClient) -> None:
    response = await unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@topten.com.bd", "password": "whatever123"},
    )
    assert response.status_code == 401


async def test_login_with_inactive_user_returns_401(
    unauthenticated_client: AsyncClient, admin_user: User, db_session: AsyncSession
) -> None:
    admin_user.is_active = False
    await db_session.commit()

    response = await unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"email": admin_user.email, "password": settings.INITIAL_ADMIN_PASSWORD},
    )
    assert response.status_code == 401


async def test_me_requires_authentication(unauthenticated_client: AsyncClient) -> None:
    response = await unauthenticated_client.get("/api/v1/auth/me")
    assert response.status_code == 401


async def test_me_returns_current_user(client: AsyncClient, admin_user: User) -> None:
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["data"]["email"] == admin_user.email


async def test_get_current_user_rejects_invalid_token(
    unauthenticated_client: AsyncClient,
) -> None:
    response = await unauthenticated_client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401


async def test_get_current_user_rejects_expired_token(
    unauthenticated_client: AsyncClient, admin_user: User
) -> None:
    now = datetime.now(UTC)
    expired_payload = {
        "sub": str(admin_user.public_id),
        "iat": now - timedelta(days=8),
        "exp": now - timedelta(days=1),
    }
    expired_token = jwt.encode(expired_payload, settings.SECRET_KEY, algorithm=JWT_ALGORITHM)

    response = await unauthenticated_client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert response.status_code == 401


async def test_get_current_user_rejects_deactivated_user(
    unauthenticated_client: AsyncClient, admin_user: User, db_session: AsyncSession
) -> None:
    token = create_access_token(user_public_id=str(admin_user.public_id))
    admin_user.is_active = False
    await db_session.commit()

    response = await unauthenticated_client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401


async def test_change_password_success_then_relogin(
    client: AsyncClient, unauthenticated_client: AsyncClient, admin_user: User
) -> None:
    response = await client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": settings.INITIAL_ADMIN_PASSWORD,
            "new_password": "new-password-123",
        },
    )
    assert response.status_code == 204

    old_password_login = await unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"email": admin_user.email, "password": settings.INITIAL_ADMIN_PASSWORD},
    )
    assert old_password_login.status_code == 401

    new_password_login = await unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"email": admin_user.email, "password": "new-password-123"},
    )
    assert new_password_login.status_code == 200


async def test_change_password_rejects_wrong_current_password(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "wrong-current-password", "new_password": "new-password-123"},
    )
    assert response.status_code == 422
