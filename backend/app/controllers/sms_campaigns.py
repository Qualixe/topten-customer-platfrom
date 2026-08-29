from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status
from pydantic import ValidationError
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db, require_permission
from app.common.exceptions import NotFoundError
from app.models.campaign import AudienceRuleType, Campaign, CampaignType
from app.models.campaign_landing_page import CampaignLandingPage
from app.services import campaign_landing_pages as landing_page_service
from app.services import forms as forms_service
from app.services import sms_campaigns as service
from app.services.sms_campaigns_audience import AudienceRule, resolve_since_campaign
from app.services.sms_campaigns_sms_utils import estimate_sms_cost
from app.tasks.sms_campaigns import resolve_campaign_audience
from app.views.campaign_landing_pages import (
    CampaignLandingPageCreate,
    CampaignLandingPageRead,
    CampaignLandingPageResponse,
    CampaignLandingPageUpdate,
)
from app.views.sms_campaigns import (
    AudienceCounts,
    AudienceCountsResponse,
    AudiencePreviewCount,
    AudiencePreviewRecipient,
    AudiencePreviewRecipientsMeta,
    AudiencePreviewRecipientsResponse,
    AudiencePreviewResponse,
    CampaignCreate,
    CampaignRead,
    CampaignRecipientsListResponse,
    CampaignRecipientsMeta,
    CampaignResponse,
    CampaignsListResponse,
    CampaignsMeta,
    CampaignStatsResponse,
    CampaignUpdate,
)

router = APIRouter()


def _audience_rule_query(
    rule_type: AudienceRuleType = Query(...),
    since_date: date | None = Query(None),
    since_campaign_id: UUID | None = Query(None),
    campaign_type: CampaignType | None = Query(None),
    before_date: date | None = Query(None),
) -> AudienceRule:
    try:
        return AudienceRule(
            rule_type=rule_type,
            since_date=since_date,
            since_campaign_id=since_campaign_id,
            campaign_type=campaign_type,
            before_date=before_date,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


async def _get_campaign_or_404(db: AsyncSession, campaign_id: UUID) -> Campaign:
    campaign = await service.get_campaign_by_public_id(db, campaign_id)
    if campaign is None:
        raise NotFoundError("Campaign not found")
    return campaign


# Static path segments are registered before "/{campaign_id}" (and its
# subpaths) — a request to e.g. /audience-counts would otherwise be
# swallowed by the dynamic route as campaign_id="audience-counts" and fail
# UUID parsing (422) instead of reaching the intended static route.
@router.get("/audience-counts", response_model=AudienceCountsResponse)
async def get_audience_counts(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.manage")),
) -> AudienceCountsResponse:
    counts = await service.count_all_static_audiences(db)
    return AudienceCountsResponse(
        data=AudienceCounts(
            general=counts[AudienceRuleType.GENERAL.value],
            vip=counts[AudienceRuleType.VIP.value],
            vvip=counts[AudienceRuleType.VVIP.value],
            missing_dob=counts[AudienceRuleType.MISSING_DOB.value],
            missing_address=counts[AudienceRuleType.MISSING_ADDRESS.value],
            missing_dob_and_address=counts[AudienceRuleType.MISSING_DOB_AND_ADDRESS.value],
            never_verified=counts[AudienceRuleType.NEVER_VERIFIED.value],
            targeted_not_verified=counts[AudienceRuleType.TARGETED_NOT_VERIFIED.value],
        )
    )


@router.get("/audience-preview", response_model=AudiencePreviewResponse)
async def get_audience_preview(
    rule: AudienceRule = Depends(_audience_rule_query),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.manage")),
) -> AudiencePreviewResponse:
    """Live count for any audience rule (including the parametrized ones —
    NEW_SINCE_DATE, NEVER_RECEIVED_TYPE, RECEIVED_TYPE_BEFORE_DATE), for
    previewing before a campaign is created."""
    resolved_rule = await resolve_since_campaign(db, rule)
    count = await service.count_audience(db, resolved_rule)
    return AudiencePreviewResponse(data=AudiencePreviewCount(count=count))


@router.get("/audience-preview-recipients", response_model=AudiencePreviewRecipientsResponse)
async def get_audience_preview_recipients(
    rule: AudienceRule = Depends(_audience_rule_query),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.manage")),
) -> AudiencePreviewRecipientsResponse:
    """A bounded, paginated peek at *which* customers a rule would match —
    for admin review before confirming a campaign. Nothing is created here;
    the real snapshot is only frozen on POST /."""
    resolved_rule = await resolve_since_campaign(db, rule)
    customers, total = await service.preview_audience_recipients(db, resolved_rule, page, page_size)
    total_pages = max(1, -(-total // page_size))

    return AudiencePreviewRecipientsResponse(
        data=[AudiencePreviewRecipient.model_validate(customer) for customer in customers],
        meta=AudiencePreviewRecipientsMeta(
            page=page, page_size=page_size, total=total, total_pages=total_pages
        ),
    )


@router.post("", response_model=CampaignResponse, status_code=http_status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.manage")),
) -> CampaignResponse:
    """Stores the audience rule and creates the campaign row immediately;
    the recipient snapshot is resolved and frozen in the background (see
    app.tasks.sms_campaigns) so a large audience (millions of
    customers) never blocks the request. `total_recipients`/`estimated_cost`
    stay 0 and `recipients_resolved_at` stays null until that finishes —
    poll GET /{id} to know when it's safe to trust them.

    If `form_id` is set, that form's landing page is attached and published
    synchronously, before the background worker is queued — a "send now"
    campaign can start sending within moments of this request returning, so
    the landing page has to exist and be live before that happens, not
    after (attaching it afterward would race the send). Any field types the
    landing page builder doesn't support (see
    app.services.forms.attach_form_to_campaign) are left out and their
    labels come back in `meta.skipped_field_labels`, same as
    `POST /{id}/landing-page/from-form/{form_id}`."""
    rule = await resolve_since_campaign(db, payload.audience_rule)

    campaign = Campaign(
        name=payload.name,
        campaign_type=payload.campaign_type.value,
        audience_rule_type=rule.rule_type.value,
        audience_rule_params=rule.storage_params(),
        message=payload.message,
        sender_id=payload.sender_id,
        sms_segments=service.compute_sms_segments(payload.message),
        scheduled_at=payload.scheduled_at,
        status=payload.status.value,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    skipped_field_labels: list[str] = []
    if payload.form_id is not None:
        form = await forms_service.get_form_by_public_id(db, payload.form_id)
        if form is None:
            raise NotFoundError("Form not found")
        landing_page, skipped_field_labels = await forms_service.attach_form_to_campaign(
            db, form=form, campaign_id=campaign.id, campaign_slug_seed=campaign.name
        )
        await landing_page_service.update_landing_page(
            db, landing_page, name=None, slug=None, builder_data=None, published=True
        )

    resolve_campaign_audience.delay(campaign.id)

    return CampaignResponse(
        data=CampaignRead.model_validate(campaign),
        meta={"skipped_field_labels": skipped_field_labels},
    )


@router.get("", response_model=CampaignsListResponse)
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.view")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    campaign_type: str | None = Query(None),
    search: str | None = Query(None, description="Matches campaign name"),
) -> CampaignsListResponse:
    filters: list[ColumnElement] = []

    if status and status != "all":
        filters.append(Campaign.status == status)
    if campaign_type and campaign_type != "all":
        filters.append(Campaign.campaign_type == campaign_type)

    search = (search or "").strip()
    if search:
        filters.append(Campaign.name.ilike(f"%{search}%"))

    count_query = select(func.count()).select_from(Campaign)
    list_query = select(Campaign)
    for condition in filters:
        count_query = count_query.where(condition)
        list_query = list_query.where(condition)

    total = (await db.execute(count_query)).scalar_one()

    list_query = (
        list_query.order_by(Campaign.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    campaigns = (await db.execute(list_query)).scalars().all()
    total_pages = max(1, -(-total // page_size))

    return CampaignsListResponse(
        data=[CampaignRead.model_validate(campaign) for campaign in campaigns],
        meta=CampaignsMeta(page=page, page_size=page_size, total=total, total_pages=total_pages),
    )


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.view")),
) -> CampaignResponse:
    campaign = await _get_campaign_or_404(db, campaign_id)
    return CampaignResponse(data=CampaignRead.model_validate(campaign))


@router.patch("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: UUID,
    payload: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.manage")),
) -> CampaignResponse:
    campaign = await _get_campaign_or_404(db, campaign_id)
    updates = payload.model_dump(exclude_unset=True)

    if updates.get("status") is not None:
        updates["status"] = updates["status"].value

    for field, value in updates.items():
        setattr(campaign, field, value)

    if "message" in updates:
        campaign.sms_segments = service.compute_sms_segments(campaign.message)
        if campaign.recipients_resolved_at is not None:
            rate = await service.get_sms_rate_per_segment(db)
            campaign.estimated_cost = estimate_sms_cost(
                campaign.sms_segments, campaign.total_recipients, rate
            )

    await db.commit()
    await db.refresh(campaign)

    return CampaignResponse(data=CampaignRead.model_validate(campaign))


@router.delete("/{campaign_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.manage")),
) -> None:
    campaign = await _get_campaign_or_404(db, campaign_id)
    await db.delete(campaign)
    await db.commit()


@router.get("/{campaign_id}/recipients", response_model=CampaignRecipientsListResponse)
async def get_campaign_recipients(
    campaign_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.view")),
) -> CampaignRecipientsListResponse:
    """The frozen recipient snapshot — always reads `campaign_recipients`
    directly, never re-resolves the audience rule."""
    campaign = await _get_campaign_or_404(db, campaign_id)
    items, total = await service.list_campaign_recipients(db, campaign.id, page, page_size)
    total_pages = max(1, -(-total // page_size))

    return CampaignRecipientsListResponse(
        data=items,
        meta=CampaignRecipientsMeta(
            page=page, page_size=page_size, total=total, total_pages=total_pages
        ),
    )


@router.get("/{campaign_id}/stats", response_model=CampaignStatsResponse)
async def get_campaign_stats(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.view")),
) -> CampaignStatsResponse:
    campaign = await _get_campaign_or_404(db, campaign_id)
    stats = await service.get_campaign_stats(db, campaign.id)
    return CampaignStatsResponse(data=stats)


def _landing_page_to_read(
    campaign: Campaign, landing_page: CampaignLandingPage
) -> CampaignLandingPageRead:
    return CampaignLandingPageRead(
        id=landing_page.public_id,
        campaign_id=campaign.public_id,
        name=landing_page.name,
        slug=landing_page.slug,
        builder_data=landing_page.builder_data,
        published=landing_page.published,
        created_at=landing_page.created_at,
        updated_at=landing_page.updated_at,
    )


@router.get("/{campaign_id}/landing-page", response_model=CampaignLandingPageResponse)
async def get_campaign_landing_page(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.view")),
) -> CampaignLandingPageResponse:
    campaign = await _get_campaign_or_404(db, campaign_id)
    landing_page = await landing_page_service.get_landing_page_by_campaign_id(db, campaign.id)
    if landing_page is None:
        raise NotFoundError("This campaign has no landing page yet")
    return CampaignLandingPageResponse(data=_landing_page_to_read(campaign, landing_page))


@router.post(
    "/{campaign_id}/landing-page",
    response_model=CampaignLandingPageResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def create_campaign_landing_page(
    campaign_id: UUID,
    payload: CampaignLandingPageCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.manage")),
) -> CampaignLandingPageResponse:
    campaign = await _get_campaign_or_404(db, campaign_id)
    landing_page = await landing_page_service.create_landing_page(
        db,
        campaign_id=campaign.id,
        name=payload.name,
        slug=payload.slug,
        builder_data=payload.builder_data,
        published=payload.published,
    )
    return CampaignLandingPageResponse(data=_landing_page_to_read(campaign, landing_page))


@router.patch("/{campaign_id}/landing-page", response_model=CampaignLandingPageResponse)
async def update_campaign_landing_page(
    campaign_id: UUID,
    payload: CampaignLandingPageUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.manage")),
) -> CampaignLandingPageResponse:
    campaign = await _get_campaign_or_404(db, campaign_id)
    landing_page = await landing_page_service.get_landing_page_by_campaign_id(db, campaign.id)
    if landing_page is None:
        raise NotFoundError("This campaign has no landing page yet")

    landing_page = await landing_page_service.update_landing_page(
        db,
        landing_page,
        name=payload.name,
        slug=payload.slug,
        builder_data=payload.builder_data,
        published=payload.published,
    )
    return CampaignLandingPageResponse(data=_landing_page_to_read(campaign, landing_page))


@router.post(
    "/{campaign_id}/landing-page/from-form/{form_id}",
    response_model=CampaignLandingPageResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def attach_form_to_campaign(
    campaign_id: UUID,
    form_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.manage")),
) -> CampaignLandingPageResponse:
    """Copies a saved Form's fields into this campaign's landing page
    (creating it if it doesn't have one yet, replacing its blocks if it
    does) — this is how a reusable Form defined at /dashboard/forms
    actually becomes sendable: it reuses the existing landing page/token/
    verification pipeline rather than a second one. The page is always
    created unpublished; publish it explicitly from the landing page
    builder once you've reviewed it. Fields with no supported landing-page
    block type (currently: generic Text Input and Phone) are left out —
    their labels come back in `meta.skipped_field_labels` so the caller can
    warn the admin.
    """
    campaign = await _get_campaign_or_404(db, campaign_id)
    form = await forms_service.get_form_by_public_id(db, form_id)
    if form is None:
        raise NotFoundError("Form not found")

    landing_page, skipped_labels = await forms_service.attach_form_to_campaign(
        db, form=form, campaign_id=campaign.id, campaign_slug_seed=campaign.name
    )
    return CampaignLandingPageResponse(
        data=_landing_page_to_read(campaign, landing_page),
        meta={"skipped_field_labels": skipped_labels},
    )
