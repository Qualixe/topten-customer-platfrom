from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import (
    PlainFieldStatus,
    SecretFieldStatus,
    get_or_create_credential_row,
    merge_credential_data,
)
from app.common.dependencies import get_db, require_permission
from app.services.sendgrid_sync import SENDGRID_PROVIDER, check_sender_verified, sync_customers
from app.views.sendgrid_marketing import (
    SendGridCredentialsResponse,
    SendGridCredentialsStatus,
    SendGridCredentialsUpdate,
    SyncRequest,
    SyncResponse,
)

router = APIRouter()

_manage = [Depends(require_permission("marketing.manage"))]


async def _to_status(data: dict[str, str | None]) -> SendGridCredentialsStatus:
    return SendGridCredentialsStatus(
        api_key=SecretFieldStatus(is_set=bool(data.get("api_key"))),
        list_name=PlainFieldStatus(value=data.get("list_name")),
        from_name=PlainFieldStatus(value=data.get("from_name")),
        from_email=PlainFieldStatus(value=data.get("from_email")),
        reply_to_email=PlainFieldStatus(value=data.get("reply_to_email")),
        sender_verified=await check_sender_verified(data),
    )


@router.get("/credentials", response_model=SendGridCredentialsResponse, dependencies=_manage)
async def get_credentials(db: AsyncSession = Depends(get_db)) -> SendGridCredentialsResponse:
    row = await get_or_create_credential_row(db, SENDGRID_PROVIDER)
    return SendGridCredentialsResponse(data=await _to_status(row.data))


@router.put("/credentials", response_model=SendGridCredentialsResponse, dependencies=_manage)
async def update_credentials(
    payload: SendGridCredentialsUpdate, db: AsyncSession = Depends(get_db)
) -> SendGridCredentialsResponse:
    updates = payload.model_dump(exclude_unset=True)
    data = await merge_credential_data(db, SENDGRID_PROVIDER, updates)
    return SendGridCredentialsResponse(data=await _to_status(data))


@router.post("/sync", response_model=SyncResponse, dependencies=_manage)
async def sync(payload: SyncRequest, db: AsyncSession = Depends(get_db)) -> SyncResponse:
    report = await sync_customers(db, customer_ids=payload.customer_ids)
    return SyncResponse(data=report)
