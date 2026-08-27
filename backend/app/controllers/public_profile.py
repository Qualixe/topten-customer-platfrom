from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db
from app.common.exceptions import NotFoundError
from app.models.campaign import Campaign
from app.models.campaign_landing_page import CampaignLandingPage
from app.models.campaign_recipient import CampaignRecipient, VerificationStatus
from app.models.customer import Customer
from app.models.customer_profile_token import CustomerProfileToken
from app.services.sms_campaigns import mark_recipient_verified
from app.views.campaign_landing_pages import PublicLandingPageData, PublicLandingPageResponse
from app.views.public_profile import (
    PublicProfileCampaign,
    PublicProfileData,
    PublicProfileResponse,
    PublicProfileUpdate,
)

router = APIRouter()

LINK_UNAVAILABLE_MESSAGE = "This link is no longer available"


async def _resolve_token_row(db: AsyncSession, token: str) -> CustomerProfileToken:
    """Missing, expired, and revoked tokens all raise the exact same 404
    with the same message — deliberately never distinguishing why a link
    doesn't work, so this endpoint can't be used to probe whether a given
    token (or customer) exists.

    Returns the token row itself, not just the customer — `token_row.
    campaign_id` (set server-side when the token was created, never
    supplied by the browser) is what makes campaign verification safe: a
    visitor can't manipulate the URL to verify themselves for a different
    campaign, because the campaign is decided entirely by which token they
    have, not by anything they send."""
    token_row = (
        await db.execute(select(CustomerProfileToken).where(CustomerProfileToken.token == token))
    ).scalar_one_or_none()

    if token_row is None:
        raise NotFoundError(LINK_UNAVAILABLE_MESSAGE)

    now = datetime.now(UTC)
    if token_row.revoked_at is not None or token_row.expires_at < now:
        raise NotFoundError(LINK_UNAVAILABLE_MESSAGE)

    return token_row


async def _build_profile_data(
    db: AsyncSession, customer: Customer, token_row: CustomerProfileToken
) -> PublicProfileData:
    campaign_info = None
    if token_row.campaign_id is not None:
        campaign = await db.get(Campaign, token_row.campaign_id)
        recipient = (
            await db.execute(
                select(CampaignRecipient).where(
                    CampaignRecipient.campaign_id == token_row.campaign_id,
                    CampaignRecipient.customer_id == customer.id,
                )
            )
        ).scalar_one_or_none()
        if campaign is not None and recipient is not None:
            campaign_info = PublicProfileCampaign(
                name=campaign.name,
                already_verified=recipient.verification_status == VerificationStatus.VERIFIED.value,
            )

    return PublicProfileData(
        name=customer.name,
        date_of_birth=customer.date_of_birth,
        address=customer.address,
        email=customer.email,
        campaign=campaign_info,
    )


@router.get("/customer-profile/{token}", response_model=PublicProfileResponse)
async def get_public_customer_profile(
    token: str, db: AsyncSession = Depends(get_db)
) -> PublicProfileResponse:
    token_row = await _resolve_token_row(db, token)
    customer = await db.get(Customer, token_row.customer_id)
    if customer is None:
        raise NotFoundError(LINK_UNAVAILABLE_MESSAGE)

    data = await _build_profile_data(db, customer, token_row)
    return PublicProfileResponse(data=data)


@router.patch("/customer-profile/{token}", response_model=PublicProfileResponse)
async def update_public_customer_profile(
    token: str, payload: PublicProfileUpdate, db: AsyncSession = Depends(get_db)
) -> PublicProfileResponse:
    token_row = await _resolve_token_row(db, token)
    customer = await db.get(Customer, token_row.customer_id)
    if customer is None:
        raise NotFoundError(LINK_UNAVAILABLE_MESSAGE)

    # Update the existing Customer record — this flow never creates a new
    # one, no matter how many campaigns the customer verifies through.
    customer.date_of_birth = payload.date_of_birth
    customer.address = payload.address
    if payload.email is not None:
        customer.email = payload.email

    # A successful form submission — and only that — means VERIFIED. SMS
    # delivery status (CampaignRecipient.status) is a completely separate
    # field and is never touched here.
    if token_row.campaign_id is not None:
        recipient = (
            await db.execute(
                select(CampaignRecipient).where(
                    CampaignRecipient.campaign_id == token_row.campaign_id,
                    CampaignRecipient.customer_id == customer.id,
                )
            )
        ).scalar_one_or_none()
        if recipient is not None:
            await mark_recipient_verified(db, recipient)

    await db.commit()
    await db.refresh(customer)

    data = await _build_profile_data(db, customer, token_row)
    return PublicProfileResponse(data=data)


@router.get("/campaign-landing-page/{slug}", response_model=PublicLandingPageResponse)
async def get_public_campaign_landing_page(
    slug: str, db: AsyncSession = Depends(get_db)
) -> PublicLandingPageResponse:
    """Content only — no campaign id, no recipient info. A draft (not yet
    published) page 404s exactly like a page that doesn't exist at all."""
    landing_page = (
        await db.execute(
            select(CampaignLandingPage).where(
                CampaignLandingPage.slug == slug,
                CampaignLandingPage.published.is_(True),
            )
        )
    ).scalar_one_or_none()
    if landing_page is None:
        raise NotFoundError("This page is not available")

    return PublicLandingPageResponse(
        data=PublicLandingPageData(name=landing_page.name, builder_data=landing_page.builder_data)
    )
