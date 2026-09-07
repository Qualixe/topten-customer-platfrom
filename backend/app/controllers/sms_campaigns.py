from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status
from pydantic import ValidationError
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db, require_permission
from app.common.exceptions import NotFoundError, ValidationAppError
from app.models import User
from app.models.campaign import (
    AudienceRuleType,
    Campaign,
    CampaignChannel,
    CampaignStatus,
    CampaignType,
)
from app.models.campaign_landing_page import CampaignLandingPage
from app.services import campaign_landing_pages as landing_page_service
from app.services import forms as forms_service
from app.services import sms_campaigns as service
from app.services.campaign_email import get_email_branding, render_campaign_email
from app.services.campaign_send_validation import (
    queue_email_campaign_send,
    validate_email_campaign_for_send,
)
from app.services.mailchimp_sync import send_test_campaign
from app.services.sms_campaigns_audience import AudienceRule, resolve_since_campaign
from app.services.sms_campaigns_sms_utils import estimate_sms_cost
from app.tasks.sms_campaigns import (
    dispatch_due_scheduled_campaigns_async,
    resolve_campaign_audience,
    retry_stuck_unresolved_campaigns_async,
)
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
    CampaignSendReadiness,
    CampaignSendReadinessResponse,
    CampaignsListResponse,
    CampaignsMeta,
    CampaignStatsResponse,
    CampaignUpdate,
    DispatchScheduledReport,
    DispatchScheduledResponse,
    PreviewEmailRequest,
    SmsOverviewStatsResponse,
)

router = APIRouter()

# Fields still editable via PATCH once an EMAIL campaign exists — its
# email content only. Everything else (name, audience rule, campaign
# type, channel, scheduling, status) is system-controlled: set once at
# creation and frozen from then on, same as the recipient snapshot it
# produces. SMS campaigns are unaffected by this — see `update_campaign`.
_EMAIL_EDITABLE_FIELDS = {"message", "subject", "mailchimp_template_sections"}
# Once an EMAIL campaign has started (or finished) sending, even its
# content is frozen — the recipients already reached can't un-receive
# what they were sent.
_EMAIL_EDITABLE_STATUSES = (CampaignStatus.DRAFT.value, CampaignStatus.FAILED.value)


def _audience_rule_query(
    rule_type: AudienceRuleType = Query(...),
    since_date: date | None = Query(None),
    since_campaign_id: UUID | None = Query(None),
    campaign_type: CampaignType | None = Query(None),
    before_date: date | None = Query(None),
    customer_type_id: UUID | None = Query(None),
) -> AudienceRule:
    try:
        return AudienceRule(
            rule_type=rule_type,
            since_date=since_date,
            since_campaign_id=since_campaign_id,
            campaign_type=campaign_type,
            before_date=before_date,
            customer_type_id=customer_type_id,
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
@router.get("/overview-stats", response_model=SmsOverviewStatsResponse)
async def get_overview_stats(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.view")),
) -> SmsOverviewStatsResponse:
    stats = await service.get_sms_overview_stats(db)
    return SmsOverviewStatsResponse(data=stats)


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

    # `message` is NOT NULL on the model even for a template-attached EMAIL
    # campaign (which has no raw HTML of its own) — store a synthesized,
    # display-only join of the section content instead, purely so Campaign
    # History and similar views have something readable to show. The real
    # send reads mailchimp_template_id/mailchimp_template_sections, never
    # this synthesized string — see app.tasks.sms_campaigns._send_email_campaign.
    if payload.mailchimp_template_id is not None:
        stored_message = (
            "\n\n".join(
                f"[{name}]\n{content}"
                for name, content in (payload.mailchimp_template_sections or {}).items()
            )
            or "(Mailchimp template)"
        )
    else:
        stored_message = payload.message

    campaign = Campaign(
        name=payload.name,
        campaign_type=payload.campaign_type.value,
        channel=payload.channel.value,
        audience_rule_type=rule.rule_type.value,
        audience_rule_params=rule.storage_params(),
        message=stored_message,
        sender_id=payload.sender_id,
        subject=payload.subject,
        mailchimp_template_id=payload.mailchimp_template_id,
        mailchimp_template_sections=payload.mailchimp_template_sections,
        # No per-segment cost model for EMAIL — stays 0, same as before
        # `estimated_cost` is resolved (see app.tasks.sms_campaigns).
        sms_segments=(
            service.compute_sms_segments(payload.message)
            if payload.channel == CampaignChannel.SMS and payload.message
            else 0
        ),
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

    if campaign.channel == CampaignChannel.EMAIL.value:
        disallowed = sorted(set(updates) - _EMAIL_EDITABLE_FIELDS)
        if disallowed:
            raise ValidationAppError(
                f"Cannot modify {', '.join(disallowed)} on an EMAIL campaign — its name, "
                "audience, type, and schedule are system-controlled and can't be edited. "
                "Only the email subject and body can be changed."
            )
        if updates and campaign.status not in _EMAIL_EDITABLE_STATUSES:
            raise ValidationAppError(
                "This campaign has already been sent or is currently sending — its email "
                "content can no longer be edited."
            )

    if updates.get("status") is not None:
        updates["status"] = updates["status"].value

    for field, value in updates.items():
        setattr(campaign, field, value)

    # Keep the synthesized display string (see `create_campaign` above) in
    # sync when just the template's section content changes.
    if "mailchimp_template_sections" in updates and campaign.mailchimp_template_id is not None:
        campaign.message = (
            "\n\n".join(
                f"[{name}]\n{content}"
                for name, content in (campaign.mailchimp_template_sections or {}).items()
            )
            or "(Mailchimp template)"
        )

    if "message" in updates and campaign.channel == CampaignChannel.SMS.value:
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


@router.get("/{campaign_id}/send-readiness", response_model=CampaignSendReadinessResponse)
async def get_campaign_send_readiness(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.view")),
) -> CampaignSendReadinessResponse:
    """Whether `POST /{campaign_id}/send-email` would succeed right now, and
    why not if not — for the campaign detail page to show a live "Ready to
    send" state (or its blocking reasons) before the admin clicks Send."""
    campaign = await _get_campaign_or_404(db, campaign_id)
    reasons = await validate_email_campaign_for_send(db, campaign)
    return CampaignSendReadinessResponse(
        data=CampaignSendReadiness(ready=not reasons, reasons=reasons)
    )


@router.post(
    "/{campaign_id}/send-email",
    response_model=CampaignResponse,
    status_code=http_status.HTTP_202_ACCEPTED,
)
async def send_email_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("campaigns.manage")),
) -> CampaignResponse:
    """Validates and, if clean, queues the real send — the only way an
    EMAIL campaign actually goes out under the locked-down campaign
    system (no more scheduling/status fields exposed for admins to set
    directly). Row-locks the campaign for the duration of the validate +
    status-flip so two concurrent clicks can't both queue a send for the
    same campaign — see
    app.services.campaign_send_validation.queue_email_campaign_send."""
    campaign = (
        await db.execute(
            select(Campaign).where(Campaign.public_id == campaign_id).with_for_update()
        )
    ).scalar_one_or_none()
    if campaign is None:
        raise NotFoundError("Campaign not found")

    await queue_email_campaign_send(db, campaign)
    await db.refresh(campaign)
    return CampaignResponse(data=CampaignRead.model_validate(campaign))


@router.post("/{campaign_id}/preview-email", status_code=http_status.HTTP_204_NO_CONTENT)
async def preview_email_campaign(
    campaign_id: UUID,
    payload: PreviewEmailRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("campaigns.manage")),
) -> None:
    """A real Mailchimp test-send of this campaign's current content,
    rendered through the same TopTen layout/personalization a real send
    uses (with placeholder recipient values, since a preview has no real
    recipient) — reuses app.services.mailchimp_sync.send_test_campaign,
    the same "send a test" path the Marketing page already uses. Defaults
    to the requesting admin's own address when none is given."""
    campaign = await _get_campaign_or_404(db, campaign_id)
    if campaign.channel != CampaignChannel.EMAIL.value:
        raise ValidationAppError("Only EMAIL campaigns can be previewed.")
    if campaign.mailchimp_template_id is None and not (campaign.message or "").strip():
        raise ValidationAppError("This campaign has no email body yet.")
    if not (campaign.subject or "").strip():
        raise ValidationAppError("This campaign has no email subject yet.")

    test_emails = payload.test_emails or [current_user.email]

    if campaign.mailchimp_template_id is None:
        company_name, company_logo = await get_email_branding(db)
        html_body = render_campaign_email(
            campaign.message,
            customer_name="Sample Customer",
            profile_link="#",
            campaign_name=campaign.name,
            company_name=company_name,
            company_logo=company_logo,
        )
        template_id = None
        template_sections = None
    else:
        html_body = None
        template_id = campaign.mailchimp_template_id
        template_sections = campaign.mailchimp_template_sections

    await send_test_campaign(
        db,
        test_emails=test_emails,
        subject=campaign.subject or "",
        html_body=html_body,
        template_id=template_id,
        template_sections=template_sections,
    )


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
    if campaign.channel == CampaignChannel.EMAIL.value:
        raise ValidationAppError(
            "Landing page configuration is system-controlled for an EMAIL campaign and can't "
            "be changed."
        )
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
    if campaign.channel == CampaignChannel.EMAIL.value:
        raise ValidationAppError(
            "Landing page configuration is system-controlled for an EMAIL campaign and can't "
            "be changed."
        )
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
    if campaign.channel == CampaignChannel.EMAIL.value:
        raise ValidationAppError(
            "Landing page configuration is system-controlled for an EMAIL campaign and can't "
            "be changed."
        )
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


@router.post("/dispatch-scheduled", response_model=DispatchScheduledResponse)
async def dispatch_scheduled(
    _: object = Depends(require_permission("campaigns.manage")),
) -> DispatchScheduledResponse:
    """Runs the same catch-up checks the periodic Celery-beat tasks run
    (see app.tasks.sms_campaigns.dispatch_due_scheduled_campaigns_async and
    retry_stuck_unresolved_campaigns_async) once, immediately — lets an
    admin unstick scheduled/resolving campaigns right now instead of
    waiting for the next scheduled poll (or as a stopgap on a deployment
    where beat isn't running at all yet). Deliberately doesn't take the
    request's own `db` dependency — both helpers open their own session via
    the default `session_factory` (the production sessionmaker), same as
    when Celery beat calls them."""
    dispatched = await dispatch_due_scheduled_campaigns_async()
    retried = await retry_stuck_unresolved_campaigns_async()
    return DispatchScheduledResponse(
        data=DispatchScheduledReport(dispatched_due=dispatched, retried_unresolved=retried)
    )
