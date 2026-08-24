from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class PermissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    label: str
    category: str


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(validation_alias="public_id")
    name: str
    description: str | None
    permissions: list[PermissionRead]


class RoleUpdate(BaseModel):
    """PATCH body for a role — replaces its permission set wholesale."""

    permission_keys: list[str]


class RoleResponse(BaseModel):
    success: bool = True
    data: RoleRead
    meta: dict = {}


class RolesListResponse(BaseModel):
    success: bool = True
    data: list[RoleRead]
    meta: dict = {}


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = Field(min_length=1, max_length=255)
    role_id: UUID

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be blank")
        return stripped


class UserUpdate(BaseModel):
    """PATCH body for a user. Only fields present in the request are
    changed. `password`, when present, resets it (no "current password"
    check — this is an admin action, not a self-service change)."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    role_id: UUID | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name cannot be blank")
        return stripped


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(validation_alias="public_id")
    email: str
    name: str
    role: RoleRead
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime


class UserResponse(BaseModel):
    success: bool = True
    data: UserRead
    meta: dict = {}


class UsersMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class UsersListResponse(BaseModel):
    success: bool = True
    data: list[UserRead]
    meta: UsersMeta


class ChangePasswordRequest(BaseModel):
    """Self-service password change (as opposed to an admin resetting
    someone else's via `UserUpdate.password`) — requires the current
    password."""

    current_password: str
    new_password: str = Field(min_length=8)
