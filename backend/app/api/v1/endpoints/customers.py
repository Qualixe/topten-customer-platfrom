from datetime import UTC, date, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db
from app.common.exceptions import NotFoundError, ValidationAppError
from app.common.phone import InvalidPhoneNumberError, normalize_phone
from app.database.models.customer import Customer, CustomerStatus, CustomerType
from app.database.models.customer_profile_token import CustomerProfileToken
from app.modules.customers.schemas import (
    CustomerCreate,
    CustomerCreateResponse,
    CustomerProfileTokenIssued,
    CustomerProfileTokenResponse,
    CustomerRead,
    CustomersListResponse,
    CustomersMeta,
    CustomerStats,
    CustomerStatsResponse,
    CustomerUpdate,
    UpcomingBirthday,
    UpcomingBirthdaysResponse,
)

router = APIRouter()

_SORTABLE_COLUMNS: dict[str, ColumnElement] = {
    "name": Customer.name,
    "total_spent": Customer.total_spent,
    "created_at": Customer.created_at,
}


def _days_until_next_birthday(dob: date, today: date) -> int:
    try:
        next_birthday = dob.replace(year=today.year)
    except ValueError:
        # dob is Feb 29 and this year isn't a leap year.
        next_birthday = date(today.year, 2, 28)

    if next_birthday < today:
        try:
            next_birthday = next_birthday.replace(year=today.year + 1)
        except ValueError:
            next_birthday = date(today.year + 1, 2, 28)

    return (next_birthday - today).days


async def _get_customer_or_404(db: AsyncSession, customer_id: UUID) -> Customer:
    customer = (
        await db.execute(select(Customer).where(Customer.public_id == customer_id))
    ).scalar_one_or_none()
    if customer is None:
        raise NotFoundError("Customer not found")
    return customer


@router.post(
    "", response_model=CustomerCreateResponse, status_code=status.HTTP_201_CREATED
)
async def create_customer(
    payload: CustomerCreate, db: AsyncSession = Depends(get_db)
) -> CustomerCreateResponse:
    try:
        normalized_phone = normalize_phone(payload.phone)
    except InvalidPhoneNumberError as exc:
        raise ValidationAppError(str(exc)) from exc

    existing = await db.execute(
        select(Customer).where(Customer.normalized_phone == normalized_phone)
    )
    if existing.scalar_one_or_none() is not None:
        raise ValidationAppError("A customer with this phone number already exists")

    customer = Customer(
        name=payload.name,
        phone=payload.phone.strip(),
        normalized_phone=normalized_phone,
        email=payload.email,
        address=payload.address,
        date_of_birth=payload.date_of_birth,
        is_vip=payload.is_vip,
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)

    return CustomerCreateResponse(data=CustomerRead.model_validate(customer))


@router.get("", response_model=CustomersListResponse)
async def list_customers(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, description="Matches name, phone, or email"),
    status: str | None = Query(None),
    is_vip: bool | None = Query(None),
    customer_type: str | None = Query(None, description="GENERAL, VIP, or VVIP"),
    sort_by: str | None = Query(None),
    sort_dir: Literal["asc", "desc"] = Query("asc"),
) -> CustomersListResponse:
    filters: list[ColumnElement] = []

    search = (search or "").strip()
    if search:
        pattern = f"%{search}%"
        filters.append(
            or_(
                Customer.name.ilike(pattern),
                Customer.phone.ilike(pattern),
                Customer.email.ilike(pattern),
            )
        )

    if status and status != "all":
        filters.append(Customer.status == status)

    if is_vip is not None:
        filters.append(Customer.is_vip == is_vip)

    if customer_type and customer_type != "all":
        valid_types = {member.value for member in CustomerType}
        if customer_type not in valid_types:
            raise ValidationAppError(
                f"Invalid customer_type {customer_type!r}; expected one of {sorted(valid_types)}"
            )
        filters.append(Customer.customer_type == customer_type)

    count_query = select(func.count()).select_from(Customer)
    list_query = select(Customer)
    for condition in filters:
        count_query = count_query.where(condition)
        list_query = list_query.where(condition)

    total = (await db.execute(count_query)).scalar_one()

    order_column = _SORTABLE_COLUMNS.get(sort_by or "", Customer.name)
    order_clause = order_column.desc() if sort_dir == "desc" else order_column.asc()
    list_query = list_query.order_by(order_clause).offset((page - 1) * page_size).limit(page_size)

    customers = (await db.execute(list_query)).scalars().all()
    total_pages = max(1, -(-total // page_size))

    return CustomersListResponse(
        data=[CustomerRead.model_validate(customer) for customer in customers],
        meta=CustomersMeta(page=page, page_size=page_size, total=total, total_pages=total_pages),
    )


@router.get("/stats", response_model=CustomerStatsResponse)
async def get_customer_stats(db: AsyncSession = Depends(get_db)) -> CustomerStatsResponse:
    """Descriptive counts for the dashboard overview — reads existing columns
    only (is_vip, total_spent, date_of_birth); no VIP/birthday business logic
    lives here."""
    total_customers = (await db.execute(select(func.count()).select_from(Customer))).scalar_one()

    vip_customers = (
        await db.execute(
            select(func.count()).select_from(Customer).where(Customer.is_vip.is_(True))
        )
    ).scalar_one()

    total_revenue = (
        await db.execute(select(func.coalesce(func.sum(Customer.total_spent), 0)))
    ).scalar_one()

    today = date.today()
    birthdays_this_month = (
        await db.execute(
            select(func.count())
            .select_from(Customer)
            .where(
                Customer.date_of_birth.is_not(None),
                func.extract("month", Customer.date_of_birth) == today.month,
            )
        )
    ).scalar_one()

    return CustomerStatsResponse(
        data=CustomerStats(
            total_customers=total_customers,
            vip_customers=vip_customers,
            birthdays_this_month=birthdays_this_month,
            total_revenue=total_revenue,
        )
    )


@router.get("/upcoming-birthdays", response_model=UpcomingBirthdaysResponse)
async def list_upcoming_birthdays(
    db: AsyncSession = Depends(get_db),
    within_days: int = Query(30, ge=1, le=365),
) -> UpcomingBirthdaysResponse:
    """Customers with a known date of birth falling in the next `within_days`
    days (month/day only, year-independent). Empty until a customer profile
    flow starts collecting date_of_birth — no data is invented here."""
    result = await db.execute(select(Customer).where(Customer.date_of_birth.is_not(None)))
    customers = result.scalars().all()

    today = date.today()
    upcoming = [
        (customer, _days_until_next_birthday(customer.date_of_birth, today))
        for customer in customers
    ]
    upcoming = [pair for pair in upcoming if pair[1] <= within_days]
    upcoming.sort(key=lambda pair: pair[1])

    return UpcomingBirthdaysResponse(
        data=[
            UpcomingBirthday(
                id=customer.public_id,
                name=customer.name,
                is_vip=customer.is_vip,
                date=customer.date_of_birth,
                days_away=days_away,
            )
            for customer, days_away in upcoming
        ]
    )


@router.patch("/{customer_id}", response_model=CustomerCreateResponse)
async def update_customer(
    customer_id: UUID, payload: CustomerUpdate, db: AsyncSession = Depends(get_db)
) -> CustomerCreateResponse:
    customer = await _get_customer_or_404(db, customer_id)
    updates = payload.model_dump(exclude_unset=True)

    if "phone" in updates:
        try:
            normalized_phone = normalize_phone(updates["phone"])
        except InvalidPhoneNumberError as exc:
            raise ValidationAppError(str(exc)) from exc

        conflict = (
            await db.execute(
                select(Customer).where(
                    Customer.normalized_phone == normalized_phone,
                    Customer.id != customer.id,
                )
            )
        ).scalar_one_or_none()
        if conflict is not None:
            raise ValidationAppError("A customer with this phone number already exists")

        customer.normalized_phone = normalized_phone
        customer.phone = updates.pop("phone").strip()

    if "status" in updates:
        valid_statuses = {member.value for member in CustomerStatus}
        if updates["status"] not in valid_statuses:
            raise ValidationAppError(
                f"Invalid status {updates['status']!r}; expected one of {sorted(valid_statuses)}"
            )

    for field, value in updates.items():
        setattr(customer, field, value)

    await db.commit()
    await db.refresh(customer)

    return CustomerCreateResponse(data=CustomerRead.model_validate(customer))


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(customer_id: UUID, db: AsyncSession = Depends(get_db)) -> None:
    customer = await _get_customer_or_404(db, customer_id)
    await db.delete(customer)
    await db.commit()


@router.post(
    "/{customer_id}/profile-token",
    response_model=CustomerProfileTokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def issue_customer_profile_token(
    customer_id: UUID, db: AsyncSession = Depends(get_db)
) -> CustomerProfileTokenResponse:
    """Mints the secure link (`/customer/{token}`) an admin sends a customer
    so they can complete their own profile. Revokes any still-active token
    for this customer first, so at most one link works at a time."""
    customer = await _get_customer_or_404(db, customer_id)

    now = datetime.now(UTC)
    active_tokens = (
        await db.execute(
            select(CustomerProfileToken).where(
                CustomerProfileToken.customer_id == customer.id,
                CustomerProfileToken.revoked_at.is_(None),
                CustomerProfileToken.expires_at > now,
            )
        )
    ).scalars().all()
    for existing_token in active_tokens:
        existing_token.revoked_at = now

    new_token = CustomerProfileToken(customer_id=customer.id)
    db.add(new_token)
    await db.commit()
    await db.refresh(new_token)

    return CustomerProfileTokenResponse(
        data=CustomerProfileTokenIssued(token=new_token.token, expires_at=new_token.expires_at)
    )
