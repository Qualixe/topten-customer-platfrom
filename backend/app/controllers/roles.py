from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db, require_permission
from app.models import Role
from app.services.users import get_role_or_404, update_role_permissions
from app.views.users import RoleRead, RoleResponse, RolesListResponse, RoleUpdate

router = APIRouter(dependencies=[Depends(require_permission("users.manage"))])


@router.get("", response_model=RolesListResponse)
async def list_roles(db: AsyncSession = Depends(get_db)) -> RolesListResponse:
    roles = (await db.execute(select(Role).order_by(Role.name))).scalars().all()
    return RolesListResponse(data=[RoleRead.model_validate(role) for role in roles])


@router.patch("/{role_id}", response_model=RoleResponse)
async def update_role_endpoint(
    role_id: UUID, payload: RoleUpdate, db: AsyncSession = Depends(get_db)
) -> RoleResponse:
    role = await get_role_or_404(db, role_id)
    role = await update_role_permissions(db, role, permission_keys=payload.permission_keys)
    return RoleResponse(data=RoleRead.model_validate(role))
