"""Idempotent seed of starter roles/permissions and a bootstrap admin user.

Run once after migrating: `python -m scripts.seed_auth` (from `backend/`).
Safe to rerun — anything that already exists (by key/name/email) is left
untouched.
"""

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models import Permission, Role, User

# (key, label, category)
PERMISSIONS: list[tuple[str, str, str]] = [
    ("customers.view", "View customers", "customers"),
    ("customers.manage", "Manage customers", "customers"),
    ("campaigns.view", "View SMS campaigns", "campaigns"),
    ("campaigns.manage", "Manage SMS campaigns", "campaigns"),
    ("imports.manage", "Import customer data", "imports"),
    ("couriers.manage", "Manage courier orders", "couriers"),
    ("settings.manage", "Manage site & integration settings", "settings"),
    ("users.manage", "Manage users and roles", "users"),
]

ALL_KEYS = [key for key, _, _ in PERMISSIONS]
MANAGER_KEYS = [key for key in ALL_KEYS if key != "users.manage"]
STAFF_KEYS = ["customers.view", "campaigns.view"]

# (name, description, permission keys)
ROLES: list[tuple[str, str, list[str]]] = [
    ("Admin", "Full access to everything, including user management.", ALL_KEYS),
    ("Manager", "Full access to day-to-day operations, excluding user management.", MANAGER_KEYS),
    ("Staff", "View-only access to customers and campaigns.", STAFF_KEYS),
]


async def seed_auth(session_factory: async_sessionmaker = SessionLocal) -> None:
    async with session_factory() as db:
        permissions_by_key: dict[str, Permission] = {}
        for key, label, category in PERMISSIONS:
            existing = (
                await db.execute(select(Permission).where(Permission.key == key))
            ).scalar_one_or_none()
            if existing is None:
                existing = Permission(key=key, label=label, category=category)
                db.add(existing)
                await db.flush()
                print(f"created permission: {key}")
            permissions_by_key[key] = existing

        roles_by_name: dict[str, Role] = {}
        for name, description, keys in ROLES:
            existing = (
                await db.execute(select(Role).where(Role.name == name))
            ).scalar_one_or_none()
            if existing is None:
                existing = Role(
                    name=name,
                    description=description,
                    permissions=[permissions_by_key[key] for key in keys],
                )
                db.add(existing)
                await db.flush()
                print(f"created role: {name}")
            roles_by_name[name] = existing

        admin_email = settings.INITIAL_ADMIN_EMAIL.strip().lower()
        admin_user = (
            await db.execute(select(User).where(User.email == admin_email))
        ).scalar_one_or_none()
        if admin_user is None:
            db.add(
                User(
                    email=admin_email,
                    hashed_password=hash_password(settings.INITIAL_ADMIN_PASSWORD),
                    name=settings.INITIAL_ADMIN_NAME,
                    role_id=roles_by_name["Admin"].id,
                )
            )
            print(f"created bootstrap admin user: {admin_email}")

        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed_auth())
