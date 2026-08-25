from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import (
    PlainFieldStatus,
    SecretFieldStatus,
    get_or_create_credential_row,
    merge_credential_data,
)
from app.common.dependencies import get_db, require_permission
from app.views.couriers import (
    PathaoCredentialsResponse,
    PathaoCredentialsStatus,
    PathaoCredentialsUpdate,
)

router = APIRouter(dependencies=[Depends(require_permission("couriers.manage"))])

PATHAO_PROVIDER = "pathao"


def _to_status(data: dict[str, str | None]) -> PathaoCredentialsStatus:
    return PathaoCredentialsStatus(
        client_id=PlainFieldStatus(value=data.get("client_id")),
        client_secret=SecretFieldStatus(is_set=bool(data.get("client_secret"))),
        username=PlainFieldStatus(value=data.get("username")),
        password=SecretFieldStatus(is_set=bool(data.get("password"))),
    )


@router.get("/pathao/credentials", response_model=PathaoCredentialsResponse)
async def get_pathao_credentials(
    db: AsyncSession = Depends(get_db),
) -> PathaoCredentialsResponse:
    row = await get_or_create_credential_row(db, PATHAO_PROVIDER)
    return PathaoCredentialsResponse(data=_to_status(row.data))


@router.put("/pathao/credentials", response_model=PathaoCredentialsResponse)
async def update_pathao_credentials(
    payload: PathaoCredentialsUpdate, db: AsyncSession = Depends(get_db)
) -> PathaoCredentialsResponse:
    updates = payload.model_dump(exclude_unset=True)
    data = await merge_credential_data(db, PATHAO_PROVIDER, updates)
    return PathaoCredentialsResponse(data=_to_status(data))
