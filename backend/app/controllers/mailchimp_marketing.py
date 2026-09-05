from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import (
    PlainFieldStatus,
    SecretFieldStatus,
    get_or_create_credential_row,
    merge_credential_data,
)
from app.common.dependencies import get_db, require_permission
from app.services.mailchimp_sync import (
    MAILCHIMP_PROVIDER,
    check_list_status,
    sync_customers,
)
from app.views.mailchimp_marketing import (
    MailchimpCredentialsResponse,
    MailchimpCredentialsStatus,
    MailchimpCredentialsUpdate,
    SyncRequest,
    SyncResponse,
)

router = APIRouter()

_manage = [Depends(require_permission("marketing.manage"))]


async def _to_status(data: dict[str, str | None]) -> MailchimpCredentialsStatus:
    is_valid, list_name = await check_list_status(data)
    return MailchimpCredentialsStatus(
        api_key=SecretFieldStatus(is_set=bool(data.get("api_key"))),
        list_id=PlainFieldStatus(value=data.get("list_id")),
        list_valid=is_valid,
        list_name=list_name,
    )


@router.get("/credentials", response_model=MailchimpCredentialsResponse, dependencies=_manage)
async def get_credentials(db: AsyncSession = Depends(get_db)) -> MailchimpCredentialsResponse:
    row = await get_or_create_credential_row(db, MAILCHIMP_PROVIDER)
    return MailchimpCredentialsResponse(data=await _to_status(row.data))


@router.put("/credentials", response_model=MailchimpCredentialsResponse, dependencies=_manage)
async def update_credentials(
    payload: MailchimpCredentialsUpdate, db: AsyncSession = Depends(get_db)
) -> MailchimpCredentialsResponse:
    updates = payload.model_dump(exclude_unset=True)
    data = await merge_credential_data(db, MAILCHIMP_PROVIDER, updates)
    return MailchimpCredentialsResponse(data=await _to_status(data))


@router.post("/sync", response_model=SyncResponse, dependencies=_manage)
async def sync(payload: SyncRequest, db: AsyncSession = Depends(get_db)) -> SyncResponse:
    report = await sync_customers(db, customer_ids=payload.customer_ids)
    return SyncResponse(data=report)
