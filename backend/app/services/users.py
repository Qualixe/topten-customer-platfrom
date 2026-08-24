from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundError, ValidationAppError
from app.core.security import hash_password
from app.models import Permission, Role, User


async def get_user_or_404(db: AsyncSession, user_id: UUID) -> User:
    user = (await db.execute(select(User).where(User.public_id == user_id))).scalar_one_or_none()
    if user is None:
        raise NotFoundError("User not found")
    return user


async def get_role_or_404(db: AsyncSession, role_id: UUID) -> Role:
    role = (await db.execute(select(Role).where(Role.public_id == role_id))).scalar_one_or_none()
    if role is None:
        raise NotFoundError("Role not found")
    return role


async def create_user(
    db: AsyncSession, *, email: str, password: str, name: str, role_id: UUID
) -> User:
    normalized_email = email.strip().lower()
    existing = (
        await db.execute(select(User).where(User.email == normalized_email))
    ).scalar_one_or_none()
    if existing is not None:
        raise ValidationAppError("A user with this email already exists")

    role = await get_role_or_404(db, role_id)

    user = User(
        email=normalized_email,
        hashed_password=hash_password(password),
        name=name,
        role_id=role.id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_user(
    db: AsyncSession,
    user: User,
    *,
    acting_user: User,
    name: str | None,
    role_id: UUID | None,
    is_active: bool | None,
    password: str | None,
) -> User:
    if is_active is False and user.id == acting_user.id:
        raise ValidationAppError("You cannot deactivate your own account")

    if name is not None:
        user.name = name
    if role_id is not None:
        user.role_id = (await get_role_or_404(db, role_id)).id
    if is_active is not None:
        user.is_active = is_active
    if password is not None:
        user.hashed_password = hash_password(password)

    await db.commit()
    await db.refresh(user)
    return user


async def delete_user(db: AsyncSession, user: User, *, acting_user: User) -> None:
    if user.id == acting_user.id:
        raise ValidationAppError("You cannot delete your own account")
    await db.delete(user)
    await db.commit()


async def update_role_permissions(
    db: AsyncSession, role: Role, *, permission_keys: list[str]
) -> Role:
    if permission_keys:
        permissions = (
            (await db.execute(select(Permission).where(Permission.key.in_(permission_keys))))
            .scalars()
            .all()
        )
        found_keys = {permission.key for permission in permissions}
        missing = set(permission_keys) - found_keys
        if missing:
            raise ValidationAppError(f"Unknown permission keys: {sorted(missing)}")
    else:
        permissions = []

    role.permissions = list(permissions)
    await db.commit()
    await db.refresh(role)
    return role
