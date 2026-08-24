from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db
from app.common.exceptions import NotFoundError
from app.database.models.customer import Customer
from app.database.models.customer_profile_token import CustomerProfileToken
from app.modules.public_profile.schemas import (
    PublicProfileData,
    PublicProfileResponse,
    PublicProfileUpdate,
)

router = APIRouter()

LINK_UNAVAILABLE_MESSAGE = "This link is no longer available"


async def _resolve_customer_by_token(db: AsyncSession, token: str) -> Customer:
    """Missing, expired, and revoked tokens all raise the exact same 404
    with the same message — deliberately never distinguishing why a link
    doesn't work, so this endpoint can't be used to probe whether a given
    token (or customer) exists."""
    token_row = (
        await db.execute(select(CustomerProfileToken).where(CustomerProfileToken.token == token))
    ).scalar_one_or_none()

    if token_row is None:
        raise NotFoundError(LINK_UNAVAILABLE_MESSAGE)

    now = datetime.now(UTC)
    if token_row.revoked_at is not None or token_row.expires_at < now:
        raise NotFoundError(LINK_UNAVAILABLE_MESSAGE)

    customer = await db.get(Customer, token_row.customer_id)
    if customer is None:
        raise NotFoundError(LINK_UNAVAILABLE_MESSAGE)

    return customer


@router.get("/customer-profile/{token}", response_model=PublicProfileResponse)
async def get_public_customer_profile(
    token: str, db: AsyncSession = Depends(get_db)
) -> PublicProfileResponse:
    customer = await _resolve_customer_by_token(db, token)
    return PublicProfileResponse(data=PublicProfileData.model_validate(customer))


@router.patch("/customer-profile/{token}", response_model=PublicProfileResponse)
async def update_public_customer_profile(
    token: str, payload: PublicProfileUpdate, db: AsyncSession = Depends(get_db)
) -> PublicProfileResponse:
    customer = await _resolve_customer_by_token(db, token)

    customer.date_of_birth = payload.date_of_birth
    customer.address = payload.address
    if payload.email is not None:
        customer.email = payload.email

    await db.commit()
    await db.refresh(customer)

    return PublicProfileResponse(data=PublicProfileData.model_validate(customer))
