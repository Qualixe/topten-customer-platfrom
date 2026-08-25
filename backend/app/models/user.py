import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.role import Role
from app.models.user_permission_override import UserPermissionOverride


class User(Base):
    """A person who can log into the dashboard. Every user has exactly one
    `Role`, which sets their default permissions — `permission_overrides`
    then adds or removes individual permissions on top of that, so one
    user can differ from the rest of their role without needing a role of
    their own. See `effective_permission_keys`."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=False, default=uuid.uuid4
    )

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)
    role: Mapped[Role] = relationship(lazy="selectin")

    permission_overrides: Mapped[list[UserPermissionOverride]] = relationship(
        lazy="selectin", cascade="all, delete-orphan", passive_deletes=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    @property
    def effective_permission_keys(self) -> list[str]:
        """The role's permissions, with this user's individual overrides
        layered on top (grants added, revokes removed)."""
        keys = {permission.key for permission in self.role.permissions}
        for override in self.permission_overrides:
            if override.granted:
                keys.add(override.permission.key)
            else:
                keys.discard(override.permission.key)
        return sorted(keys)
