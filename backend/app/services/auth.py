from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import UnauthorizedError, ValidationAppError
from app.core.security import hash_password, verify_password
from app.models import User
from app.views.auth import AuthUser


async def authenticate(db: AsyncSession, *, email: str, password: str) -> User:
    """Verifies credentials and records the login. Raises `UnauthorizedError`
    for any failure — wrong email, wrong password, or a deactivated account —
    all with the same message, so a bad guess can't be used to enumerate
    which emails exist."""
    user = (
        await db.execute(select(User).where(User.email == email.strip().lower()))
    ).scalar_one_or_none()

    if user is None or not user.is_active or not verify_password(password, user.hashed_password):
        raise UnauthorizedError("Invalid email or password")

    user.last_login_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(user)
    return user


async def change_password(
    db: AsyncSession, user: User, *, current_password: str, new_password: str
) -> None:
    if not verify_password(current_password, user.hashed_password):
        raise ValidationAppError("Current password is incorrect")
    user.hashed_password = hash_password(new_password)
    await db.commit()


def to_auth_user(user: User) -> AuthUser:
    return AuthUser(
        email=user.email,
        name=user.name,
        role=user.role.name,
        permissions=sorted(permission.key for permission in user.role.permissions),
    )
