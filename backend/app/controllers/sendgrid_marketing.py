from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import (
    PlainFieldStatus,
    SecretFieldStatus,
    get_or_create_credential_row,
    merge_credential_data,
)
from app.common.dependencies import get_db, require_permission
from app.services.sendgrid_sync import (
    SENDGRID_PROVIDER,
    check_sender_verified,
    create_campaign_draft,
    get_campaign_by_public_id,
    list_campaigns,
    send_campaign_draft,
    sync_customers,
)
from app.views.sendgrid_marketing import (
    CreateCampaignRequest,
    SendGridCampaignListResponse,
    SendGridCampaignRead,
    SendGridCampaignResponse,
    SendGridCredentialsResponse,
    SendGridCredentialsStatus,
    SendGridCredentialsUpdate,
    SyncRequest,
    SyncResponse,
)

router = APIRouter()

_view = [Depends(require_permission("marketing.view"))]
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


@router.post("/campaigns", response_model=SendGridCampaignResponse, dependencies=_manage)
async def create_campaign(
    payload: CreateCampaignRequest, db: AsyncSession = Depends(get_db)
) -> SendGridCampaignResponse:
    row = await create_campaign_draft(
        db,
        customer_ids=payload.customer_ids,
        subject=payload.subject,
        html_body=payload.html_body,
        from_name=payload.from_name,
        from_email=payload.from_email,
    )
    return SendGridCampaignResponse(data=SendGridCampaignRead.model_validate(row))


@router.post(
    "/campaigns/{campaign_id}/send",
    response_model=SendGridCampaignResponse,
    dependencies=_manage,
)
async def send_campaign(
    campaign_id: UUID, db: AsyncSession = Depends(get_db)
) -> SendGridCampaignResponse:
    campaign = await get_campaign_by_public_id(db, campaign_id)
    sent = await send_campaign_draft(db, campaign)
    return SendGridCampaignResponse(data=SendGridCampaignRead.model_validate(sent))


@router.get("/campaigns", response_model=SendGridCampaignListResponse, dependencies=_view)
async def list_all_campaigns(db: AsyncSession = Depends(get_db)) -> SendGridCampaignListResponse:
    rows = await list_campaigns(db)
    return SendGridCampaignListResponse(
        data=[SendGridCampaignRead.model_validate(row) for row in rows]
    )
