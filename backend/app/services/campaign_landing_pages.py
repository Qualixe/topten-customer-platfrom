"""CRUD for a campaign's landing page. One page per campaign — see
`CampaignLandingPage.campaign_id`'s unique constraint.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import ValidationAppError
from app.models.campaign_landing_page import CampaignLandingPage
from app.views.campaign_landing_pages import LandingPageBuilderData


async def get_landing_page_by_campaign_id(
    db: AsyncSession, campaign_id: int
) -> CampaignLandingPage | None:
    return (
        await db.execute(
            select(CampaignLandingPage).where(CampaignLandingPage.campaign_id == campaign_id)
        )
    ).scalar_one_or_none()


async def get_published_landing_page_by_slug(
    db: AsyncSession, slug: str
) -> CampaignLandingPage | None:
    """Only a published page is ever returned — a draft must never be
    reachable on the public site."""
    return (
        await db.execute(
            select(CampaignLandingPage).where(
                CampaignLandingPage.slug == slug,
                CampaignLandingPage.published.is_(True),
            )
        )
    ).scalar_one_or_none()


async def _ensure_slug_available(
    db: AsyncSession, slug: str, *, exclude_id: int | None = None
) -> None:
    query = select(CampaignLandingPage).where(CampaignLandingPage.slug == slug)
    if exclude_id is not None:
        query = query.where(CampaignLandingPage.id != exclude_id)
    existing = (await db.execute(query)).scalar_one_or_none()
    if existing is not None:
        raise ValidationAppError(f'The slug "{slug}" is already in use by another landing page')


async def create_landing_page(
    db: AsyncSession,
    *,
    campaign_id: int,
    name: str,
    slug: str,
    builder_data: LandingPageBuilderData,
    published: bool,
) -> CampaignLandingPage:
    existing = await get_landing_page_by_campaign_id(db, campaign_id)
    if existing is not None:
        raise ValidationAppError("This campaign already has a landing page — use PATCH to edit it")

    await _ensure_slug_available(db, slug)

    landing_page = CampaignLandingPage(
        campaign_id=campaign_id,
        name=name,
        slug=slug,
        builder_data=builder_data.model_dump(mode="json"),
        published=published,
    )
    db.add(landing_page)
    await db.commit()
    await db.refresh(landing_page)
    return landing_page


async def update_landing_page(
    db: AsyncSession,
    landing_page: CampaignLandingPage,
    *,
    name: str | None,
    slug: str | None,
    builder_data: LandingPageBuilderData | None,
    published: bool | None,
) -> CampaignLandingPage:
    if slug is not None and slug != landing_page.slug:
        await _ensure_slug_available(db, slug, exclude_id=landing_page.id)
        landing_page.slug = slug
    if name is not None:
        landing_page.name = name
    if builder_data is not None:
        landing_page.builder_data = builder_data.model_dump(mode="json")
    if published is not None:
        landing_page.published = published

    await db.commit()
    await db.refresh(landing_page)
    return landing_page
