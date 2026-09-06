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
    create_and_send_campaign,
    send_test_campaign,
    sync_customers,
)
from app.views.mailchimp_marketing import (
    MailchimpCredentialsResponse,
    MailchimpCredentialsStatus,
    MailchimpCredentialsUpdate,
    SendCampaignRequest,
    SendCampaignResponse,
    SendTestCampaignRequest,
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
        from_name=PlainFieldStatus(value=data.get("from_name")),
        reply_to_email=PlainFieldStatus(value=data.get("reply_to_email")),
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


@router.post("/send", response_model=SendCampaignResponse, dependencies=_manage)
async def send(
    payload: SendCampaignRequest, db: AsyncSession = Depends(get_db)
) -> SendCampaignResponse:
    report = await create_and_send_campaign(
        db,
        customer_ids=payload.customer_ids,
        subject=payload.subject,
        html_body=payload.html_body,
    )
    return SendCampaignResponse(data=report)


@router.post("/send-test", status_code=204, dependencies=_manage)
async def send_test(
    payload: SendTestCampaignRequest, db: AsyncSession = Depends(get_db)
) -> None:
    await send_test_campaign(
        db,
        test_emails=payload.test_emails,
        subject=payload.subject,
        html_body=payload.html_body,
    )
