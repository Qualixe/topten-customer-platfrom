import csv
import io
from collections.abc import AsyncIterator
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import ColumnElement, and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db, require_permission
from app.common.exceptions import NotFoundError, ValidationAppError
from app.common.phone import InvalidPhoneNumberError, normalize_phone
from app.models.campaign import Campaign
from app.models.campaign_recipient import CampaignRecipient, VerificationStatus
from app.models.customer import Customer, CustomerStatus, CustomerType
from app.models.customer_monthly_spending import CustomerMonthlySpending
from app.models.customer_profile_token import CustomerProfileToken
from app.views.customers import (
    CustomerCreate,
    CustomerCreateResponse,
    CustomerProfileTokenIssued,
    CustomerProfileTokenResponse,
    CustomerRead,
    CustomerSegments,
    CustomerSegmentsResponse,
    CustomersListResponse,
    CustomersMeta,
    CustomerStats,
    CustomerStatsResponse,
    CustomerUpdate,
    SegmentBucket,
    UpcomingBirthday,
    UpcomingBirthdaysResponse,
    VerifiedCustomerRead,
    VerifiedCustomersListResponse,
    VipCustomerRead,
    VipCustomersListResponse,
    VipCustomerStats,
    VipCustomerStatsResponse,
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
    payload: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("customers.manage")),
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


def _build_customer_filters(
    *,
    search: str | None,
    status: str | None,
    is_vip: bool | None,
    customer_type: str | None,
    profile_status: str | None,
    verified: bool | None,
    created_from: date | None,
    created_to: date | None,
) -> list[ColumnElement]:
    """Shared WHERE-clause builder for `GET /customers` and
    `GET /customers/export` — the export must return exactly the rows the
    list view would show for the same filters."""
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

    # profile_status is derived (see Customer.profile_status), not a stored
    # column — this is that same COMPLETE rule expressed in SQL.
    is_complete = and_(
        Customer.date_of_birth.is_not(None),
        Customer.address.is_not(None),
        Customer.email.is_not(None),
    )
    if profile_status == "COMPLETE":
        filters.append(is_complete)
    elif profile_status == "INCOMPLETE":
        filters.append(~is_complete)

    # Verification is a per-(customer, campaign) fact on CampaignRecipient,
    # not a stored Customer column — a customer counts as "verified" here
    # if they've completed at least one campaign's profile form, regardless
    # of which campaign or how many.
    if verified:
        filters.append(
            select(CampaignRecipient.id)
            .where(
                CampaignRecipient.customer_id == Customer.id,
                CampaignRecipient.verification_status == VerificationStatus.VERIFIED.value,
            )
            .exists()
        )

    if created_from is not None:
        filters.append(Customer.created_at >= created_from)
    if created_to is not None:
        filters.append(Customer.created_at < created_to + timedelta(days=1))

    return filters


@router.get("", response_model=CustomersListResponse)
async def list_customers(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("customers.view")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, description="Matches name, phone, or email"),
    status: str | None = Query(None),
    is_vip: bool | None = Query(None),
    customer_type: str | None = Query(None, description="GENERAL, VIP, or VVIP"),
    profile_status: str | None = Query(None, description="COMPLETE or INCOMPLETE"),
    verified: bool | None = Query(
        None, description="True to only return customers verified through at least one campaign"
    ),
    created_from: date | None = Query(None),
    created_to: date | None = Query(None),
    sort_by: str | None = Query(None),
    sort_dir: Literal["asc", "desc"] = Query("asc"),
) -> CustomersListResponse:
    filters = _build_customer_filters(
        search=search,
        status=status,
        is_vip=is_vip,
        customer_type=customer_type,
        profile_status=profile_status,
        verified=verified,
        created_from=created_from,
        created_to=created_to,
    )

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


_EXPORT_CHUNK_SIZE = 500
_EXPORT_COLUMNS = (
    "Customer ID",
    "Name",
    "Phone",
    "Email",
    "Address",
    "Date of Birth",
    "Customer Type",
    "VIP",
    "Total Spent",
    "Status",
    "Profile Status",
    "Created At",
)


def _customer_export_row(customer: Customer) -> tuple[str, ...]:
    record = CustomerRead.model_validate(customer)
    return (
        str(record.id),
        record.name,
        record.phone,
        record.email or "",
        record.address or "",
        record.date_of_birth.isoformat() if record.date_of_birth else "",
        record.customer_type.value,
        "Yes" if record.is_vip else "No",
        str(record.total_spent),
        record.status,
        record.profile_status,
        record.created_at.isoformat(),
    )


async def _stream_customers_csv(
    db: AsyncSession, filters: list[ColumnElement], order_clause: ColumnElement
) -> AsyncIterator[str]:
    """Writes the header immediately, then streams matching customers in
    fixed-size pages (rather than loading the whole table into memory) —
    same chunked-processing spirit as the CSV *import* pipeline in
    `app/tasks/imports.py`, just in reverse."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    writer.writerow(_EXPORT_COLUMNS)
    yield buffer.getvalue()
    buffer.seek(0)
    buffer.truncate(0)

    offset = 0
    while True:
        query = select(Customer)
        for condition in filters:
            query = query.where(condition)
        query = query.order_by(order_clause).offset(offset).limit(_EXPORT_CHUNK_SIZE)

        page_rows = (await db.execute(query)).scalars().all()
        if not page_rows:
            break

        for customer in page_rows:
            writer.writerow(_customer_export_row(customer))
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)

        if len(page_rows) < _EXPORT_CHUNK_SIZE:
            break
        offset += _EXPORT_CHUNK_SIZE


@router.get("/export")
async def export_customers_csv(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("customers.view")),
    search: str | None = Query(None, description="Matches name, phone, or email"),
    status: str | None = Query(None),
    is_vip: bool | None = Query(None),
    customer_type: str | None = Query(None, description="GENERAL, VIP, or VVIP"),
    profile_status: str | None = Query(None, description="COMPLETE or INCOMPLETE"),
    verified: bool | None = Query(
        None, description="True to only return customers verified through at least one campaign"
    ),
    created_from: date | None = Query(None),
    created_to: date | None = Query(None),
    sort_by: str | None = Query(None),
    sort_dir: Literal["asc", "desc"] = Query("asc"),
) -> StreamingResponse:
    """Same filters as `GET /customers`, minus pagination — every matching
    row is exported, not just the current page."""
    filters = _build_customer_filters(
        search=search,
        status=status,
        is_vip=is_vip,
        customer_type=customer_type,
        profile_status=profile_status,
        verified=verified,
        created_from=created_from,
        created_to=created_to,
    )
    order_column = _SORTABLE_COLUMNS.get(sort_by or "", Customer.name)
    order_clause = order_column.desc() if sort_dir == "desc" else order_column.asc()

    filename = f"customers-{datetime.now(UTC):%Y%m%d-%H%M%S}.csv"
    return StreamingResponse(
        _stream_customers_csv(db, filters, order_clause),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/stats", response_model=CustomerStatsResponse)
async def get_customer_stats(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("customers.view")),
) -> CustomerStatsResponse:
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


_STATUS_LABELS = {member.value: member.value.capitalize() for member in CustomerStatus}


async def _segment_buckets(
    db: AsyncSession, column: ColumnElement, labels: dict[str, str]
) -> list[SegmentBucket]:
    """Grouped counts for one dimension, sorted largest-first. Values with
    zero customers never appear (nothing to `GROUP BY`), matching the "only
    show populated segments" display in the reference design."""
    query = select(column, func.count()).group_by(column).order_by(func.count().desc())
    rows = (await db.execute(query)).all()
    return [
        SegmentBucket(value=value, label=labels.get(value, value), count=count)
        for value, count in rows
    ]


async def _tier_buckets(db: AsyncSession) -> list[SegmentBucket]:
    """VIP vs Regular, grouped by `is_vip` — the field the "VIP Customers"
    page and the customers list's Tier filter both actually use. Not
    `customer_type` (GENERAL/VIP/VVIP): that enum is never set by any flow
    in this app yet and every row is stuck at GENERAL, so grouping by it
    would hide real VIP customers behind a single meaningless bucket."""
    query = (
        select(Customer.is_vip, func.count())
        .group_by(Customer.is_vip)
        .order_by(func.count().desc())
    )
    rows = (await db.execute(query)).all()
    return [
        SegmentBucket(
            value="VIP" if is_vip else "REGULAR",
            label="VIP" if is_vip else "Regular",
            count=count,
        )
        for is_vip, count in rows
    ]


@router.get("/segments", response_model=CustomerSegmentsResponse)
async def get_customer_segments(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("customers.view")),
) -> CustomerSegmentsResponse:
    """Live breakdowns for campaign targeting. Only reports dimensions the
    schema actually has meaningful data for (status, VIP tier) — city,
    gender, group, and tag aren't stored yet, so the frontend renders those
    as empty placeholders instead of this endpoint faking data for them."""
    return CustomerSegmentsResponse(
        data=CustomerSegments(
            by_status=await _segment_buckets(db, Customer.status, _STATUS_LABELS),
            by_tier=await _tier_buckets(db),
        )
    )


@router.get("/upcoming-birthdays", response_model=UpcomingBirthdaysResponse)
async def list_upcoming_birthdays(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("customers.view")),
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
                email=customer.email,
                is_vip=customer.is_vip,
                date=customer.date_of_birth,
                days_away=days_away,
            )
            for customer, days_away in upcoming
        ]
    )


def _vip_latest_period_subquery():
    """Per-customer most recent (year, month) with non-zero recorded
    spending, encoded as `year * 12 + month` for easy comparison. Null for a
    VIP customer with no spending history at all."""
    period_expr = CustomerMonthlySpending.year * 12 + (CustomerMonthlySpending.month - 1)
    return (
        select(
            CustomerMonthlySpending.customer_id.label("customer_id"),
            func.max(period_expr).label("latest_period"),
        )
        .where(CustomerMonthlySpending.amount > 0)
        .group_by(CustomerMonthlySpending.customer_id)
        .subquery()
    )


def _vip_status_expr(latest_period_column, at_risk_cutoff: int):
    """ACTIVE unless the customer is administratively non-active (INACTIVE),
    or their latest recorded spending month is more than two calendar
    months behind today (AT_RISK). A customer with no spending history at
    all is left ACTIVE rather than flagged — that's "no data", not "slowing
    down"."""
    return case(
        (Customer.status != CustomerStatus.ACTIVE.value, "INACTIVE"),
        (
            and_(latest_period_column.is_not(None), latest_period_column < at_risk_cutoff),
            "AT_RISK",
        ),
        else_="ACTIVE",
    )


@router.get("/vip", response_model=VipCustomersListResponse)
async def list_vip_customers(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("customers.view")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, description="Matches name, phone, or email"),
    vip_status: str | None = Query(None, description="ACTIVE, AT_RISK, or INACTIVE"),
) -> VipCustomersListResponse:
    today = date.today()
    current_period = today.year * 12 + (today.month - 1)
    at_risk_cutoff = current_period - 2

    latest_period_subq = _vip_latest_period_subquery()
    status_expr = _vip_status_expr(latest_period_subq.c.latest_period, at_risk_cutoff)

    filters: list[ColumnElement] = [Customer.is_vip.is_(True)]
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
    if vip_status and vip_status != "all":
        valid_statuses = {"ACTIVE", "AT_RISK", "INACTIVE"}
        if vip_status not in valid_statuses:
            raise ValidationAppError(
                f"Invalid status {vip_status!r}; expected one of {sorted(valid_statuses)}"
            )
        filters.append(status_expr == vip_status)

    base_from = select(Customer, latest_period_subq.c.latest_period, status_expr).outerjoin(
        latest_period_subq, Customer.id == latest_period_subq.c.customer_id
    )
    count_query = (
        select(func.count())
        .select_from(Customer)
        .outerjoin(latest_period_subq, Customer.id == latest_period_subq.c.customer_id)
    )
    for condition in filters:
        base_from = base_from.where(condition)
        count_query = count_query.where(condition)

    total = (await db.execute(count_query)).scalar_one()

    list_query = (
        base_from.order_by(Customer.total_spent.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(list_query)).all()
    total_pages = max(1, -(-total // page_size))

    data = [
        VipCustomerRead(
            id=customer.public_id,
            name=customer.name,
            email=customer.email,
            phone=customer.phone,
            address=customer.address,
            customer_type=customer.customer_type,
            status=row_status,
            total_spent=customer.total_spent,
            last_purchase_year=latest_period // 12 if latest_period is not None else None,
            last_purchase_month=(latest_period % 12) + 1 if latest_period is not None else None,
            member_since=customer.created_at,
        )
        for customer, latest_period, row_status in rows
    ]

    return VipCustomersListResponse(
        data=data,
        meta=CustomersMeta(page=page, page_size=page_size, total=total, total_pages=total_pages),
    )


@router.get("/vip/stats", response_model=VipCustomerStatsResponse)
async def get_vip_customer_stats(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("customers.view")),
) -> VipCustomerStatsResponse:
    today = date.today()
    current_period = today.year * 12 + (today.month - 1)
    at_risk_cutoff = current_period - 2

    latest_period_subq = _vip_latest_period_subquery()
    status_expr = _vip_status_expr(latest_period_subq.c.latest_period, at_risk_cutoff)

    stats_query = (
        select(
            func.count().label("total"),
            func.coalesce(func.sum(Customer.total_spent), 0).label("total_revenue"),
            func.count().filter(status_expr == "AT_RISK").label("at_risk"),
        )
        .select_from(Customer)
        .outerjoin(latest_period_subq, Customer.id == latest_period_subq.c.customer_id)
        .where(Customer.is_vip.is_(True))
    )
    row = (await db.execute(stats_query)).one()
    average_spend = (
        (row.total_revenue / row.total).quantize(Decimal("0.01")) if row.total else Decimal("0")
    )

    return VipCustomerStatsResponse(
        data=VipCustomerStats(
            total_vip_customers=row.total,
            total_vip_revenue=row.total_revenue,
            average_spend=average_spend,
            at_risk_count=row.at_risk,
        )
    )


@router.get("/verified", response_model=VerifiedCustomersListResponse)
async def list_verified_customers(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("customers.view")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, description="Matches name or phone"),
    campaign_id: UUID | None = Query(None),
    customer_type: str | None = Query(None, description="GENERAL, VIP, or VVIP"),
    verified_from: date | None = Query(None),
    verified_to: date | None = Query(None),
) -> VerifiedCustomersListResponse:
    """One row per (customer, campaign) VERIFIED pair — a customer who
    verified through two campaigns appears twice here, never duplicating
    the underlying Customer row. Reads only `CampaignRecipient.
    verification_status`, never `status` (SMS delivery is a different
    thing — see VerificationStatus's docstring)."""
    filters: list[ColumnElement] = [
        CampaignRecipient.verification_status == VerificationStatus.VERIFIED.value
    ]

    search = (search or "").strip()
    if search:
        pattern = f"%{search}%"
        filters.append(or_(Customer.name.ilike(pattern), Customer.phone.ilike(pattern)))

    if campaign_id is not None:
        campaign = await _get_campaign_or_404(db, campaign_id)
        filters.append(CampaignRecipient.campaign_id == campaign.id)

    if customer_type and customer_type != "all":
        valid_types = {member.value for member in CustomerType}
        if customer_type not in valid_types:
            raise ValidationAppError(
                f"Invalid customer_type {customer_type!r}; expected one of {sorted(valid_types)}"
            )
        filters.append(Customer.customer_type == customer_type)

    if verified_from is not None:
        filters.append(CampaignRecipient.verified_at >= verified_from)
    if verified_to is not None:
        filters.append(CampaignRecipient.verified_at < verified_to + timedelta(days=1))

    base_query = (
        select(CampaignRecipient, Customer, Campaign)
        .join(Customer, Customer.id == CampaignRecipient.customer_id)
        .join(Campaign, Campaign.id == CampaignRecipient.campaign_id)
    )
    count_query = (
        select(func.count())
        .select_from(CampaignRecipient)
        .join(Customer, Customer.id == CampaignRecipient.customer_id)
        .join(Campaign, Campaign.id == CampaignRecipient.campaign_id)
    )
    for condition in filters:
        base_query = base_query.where(condition)
        count_query = count_query.where(condition)

    total = (await db.execute(count_query)).scalar_one()

    list_query = (
        base_query.order_by(CampaignRecipient.verified_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(list_query)).all()
    total_pages = max(1, -(-total // page_size))

    data = [
        VerifiedCustomerRead(
            id=customer.public_id,
            name=customer.name,
            phone=customer.phone,
            campaign_id=campaign.public_id,
            campaign_name=campaign.name,
            customer_type=customer.customer_type,
            verified_at=recipient.verified_at,
            date_of_birth=customer.date_of_birth,
            address=customer.address,
            email=customer.email,
        )
        for recipient, customer, campaign in rows
    ]

    return VerifiedCustomersListResponse(
        data=data,
        meta=CustomersMeta(page=page, page_size=page_size, total=total, total_pages=total_pages),
    )


async def _get_campaign_or_404(db: AsyncSession, campaign_id: UUID) -> Campaign:
    campaign = (
        await db.execute(select(Campaign).where(Campaign.public_id == campaign_id))
    ).scalar_one_or_none()
    if campaign is None:
        raise NotFoundError("Campaign not found")
    return campaign


@router.patch("/{customer_id}", response_model=CustomerCreateResponse)
async def update_customer(
    customer_id: UUID,
    payload: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("customers.manage")),
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
async def delete_customer(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("customers.manage")),
) -> None:
    customer = await _get_customer_or_404(db, customer_id)
    await db.delete(customer)
    await db.commit()


@router.post(
    "/{customer_id}/profile-token",
    response_model=CustomerProfileTokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def issue_customer_profile_token(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("customers.manage")),
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
