from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db, require_permission
from app.models import User
from app.services.users import create_user, delete_user, get_user_or_404, update_user
from app.views.users import (
    UserCreate,
    UserRead,
    UserResponse,
    UsersListResponse,
    UsersMeta,
    UserUpdate,
)

router = APIRouter(dependencies=[Depends(require_permission("users.manage"))])


@router.get("", response_model=UsersListResponse)
async def list_users(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> UsersListResponse:
    total = (await db.execute(select(func.count()).select_from(User))).scalar_one()

    users = (
        (
            await db.execute(
                select(User)
                .order_by(User.name)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    total_pages = max(1, -(-total // page_size))

    return UsersListResponse(
        data=[UserRead.model_validate(user) for user in users],
        meta=UsersMeta(page=page, page_size=page_size, total=total, total_pages=total_pages),
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user_endpoint(
    payload: UserCreate, db: AsyncSession = Depends(get_db)
) -> UserResponse:
    user = await create_user(
        db, email=payload.email, password=payload.password, name=payload.name,
        role_id=payload.role_id,
    )
    return UserResponse(data=UserRead.model_validate(user))


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user_endpoint(
    user_id: UUID,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    acting_user: User = Depends(require_permission("users.manage")),
) -> UserResponse:
    user = await get_user_or_404(db, user_id)
    user = await update_user(
        db,
        user,
        acting_user=acting_user,
        name=payload.name,
        role_id=payload.role_id,
        is_active=payload.is_active,
        password=payload.password,
    )
    return UserResponse(data=UserRead.model_validate(user))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_endpoint(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    acting_user: User = Depends(require_permission("users.manage")),
) -> None:
    user = await get_user_or_404(db, user_id)
    await delete_user(db, user, acting_user=acting_user)
