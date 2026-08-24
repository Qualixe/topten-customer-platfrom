from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_current_user, get_db
from app.core.security import create_access_token
from app.models import User
from app.services.auth import authenticate, change_password, to_auth_user
from app.views.auth import LoginData, LoginRequest, LoginResponse, MeResponse
from app.views.users import ChangePasswordRequest

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> LoginResponse:
    user = await authenticate(db, email=payload.email, password=payload.password)
    token = create_access_token(user_public_id=str(user.public_id))
    return LoginResponse(data=LoginData(token=token, user=to_auth_user(user)))


@router.get("/me", response_model=MeResponse)
async def get_me(user: User = Depends(get_current_user)) -> MeResponse:
    return MeResponse(data=to_auth_user(user))


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password_endpoint(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    await change_password(
        db, user, current_password=payload.current_password, new_password=payload.new_password
    )
