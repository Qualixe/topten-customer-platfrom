import uuid
from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.database import get_db
from app.models import User

__all__ = ["get_db", "get_current_user", "require_permission"]


async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    """Resolves the caller from an `Authorization: Bearer <token>` header.

    Raises `UnauthorizedError` for anything that isn't a valid, unexpired
    token belonging to an active user — the header being missing entirely
    included, since every protected router requires this dependency.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise UnauthorizedError()

    payload = decode_access_token(auth_header.removeprefix("Bearer "))
    if payload is None:
        raise UnauthorizedError()

    try:
        public_id = uuid.UUID(payload.get("sub", ""))
    except ValueError as exc:
        raise UnauthorizedError() from exc

    user = (
        await db.execute(select(User).where(User.public_id == public_id))
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        raise UnauthorizedError()

    return user


def require_permission(key: str) -> Callable[[User], Coroutine[Any, Any, User]]:
    """Dependency factory: gates a route on the caller's *effective*
    permissions — their role's, with their individual overrides applied."""

    async def check(user: User = Depends(get_current_user)) -> User:
        if key not in user.effective_permission_keys:
            raise ForbiddenError()
        return user

    return check
