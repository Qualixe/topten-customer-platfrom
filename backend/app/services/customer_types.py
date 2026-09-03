"""Customer type CRUD. Unlike app.services.gifts's category functions (which
this otherwise mirrors), there is no delete here — only an `is_active`
toggle, so a type stays permanently valid for existing customer/import-batch
history even after an admin retires it. The three `is_system` rows
(General/VIP/VVIP, seeded when this table replaced the old fixed enum) can
never be renamed or deactivated, because SMS campaign audience targeting
resolves them by exact name (see get_seed_customer_type_id below, used from
app.services.sms_campaigns_audience) and deliberately does not extend to
arbitrary admin-added types."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundError, ValidationAppError
from app.models.customer_type import CustomerType


async def get_customer_type_or_404(db: AsyncSession, type_id: UUID) -> CustomerType:
    customer_type = (
        await db.execute(select(CustomerType).where(CustomerType.public_id == type_id))
    ).scalar_one_or_none()
    if customer_type is None:
        raise NotFoundError("Customer type not found")
    return customer_type


async def list_customer_types(db: AsyncSession) -> list[CustomerType]:
    result = await db.execute(select(CustomerType).order_by(CustomerType.name))
    return list(result.scalars().all())


async def create_customer_type(db: AsyncSession, *, name: str) -> CustomerType:
    existing = (
        await db.execute(select(CustomerType).where(CustomerType.name == name))
    ).scalar_one_or_none()
    if existing is not None:
        raise ValidationAppError(f'A customer type named "{name}" already exists')

    customer_type = CustomerType(name=name)
    db.add(customer_type)
    await db.commit()
    await db.refresh(customer_type)
    return customer_type


async def update_customer_type(
    db: AsyncSession,
    customer_type: CustomerType,
    *,
    name: str | None = None,
    is_active: bool | None = None,
) -> CustomerType:
    if name is not None and name != customer_type.name:
        if customer_type.is_system:
            raise ValidationAppError(
                f'"{customer_type.name}" is a built-in customer type and can\'t be renamed.'
            )

        conflict = (
            await db.execute(
                select(CustomerType).where(
                    CustomerType.name == name, CustomerType.id != customer_type.id
                )
            )
        ).scalar_one_or_none()
        if conflict is not None:
            raise ValidationAppError(f'A customer type named "{name}" already exists')

        customer_type.name = name

    if is_active is not None and is_active != customer_type.is_active:
        if customer_type.is_system and not is_active:
            raise ValidationAppError(
                f'"{customer_type.name}" is a built-in customer type and can\'t be deactivated.'
            )
        customer_type.is_active = is_active

    await db.commit()
    await db.refresh(customer_type)
    return customer_type


async def get_vip_tier_type_ids(db: AsyncSession) -> list[int]:
    """The VIP and VVIP built-in type ids — what the "VIP Customers" page
    (GET /customers/vip, /customers/vip/stats) filters on. Deliberately
    just these two, not every type: that page is specifically about the
    VIP/VVIP concept, not a generic "anyone who isn't General" view."""
    return [
        await get_seed_customer_type_id(db, "VIP"),
        await get_seed_customer_type_id(db, "VVIP"),
    ]


async def get_seed_customer_type_id(db: AsyncSession, name: str) -> int:
    """Resolves one of the three built-in type names ("General"/"VIP"/
    "VVIP") to its row id — used only by SMS campaign audience targeting
    (see app.services.sms_campaigns_audience.build_condition), which stays
    limited to exactly these three regardless of what other types an admin
    has since added. Not cached: this is a cheap, indexed lookup, and a
    process-lifetime cache could go stale in a way that's hard to reason
    about (e.g. if a seed row ever needed a direct DB fix)."""
    customer_type = (
        await db.execute(select(CustomerType).where(CustomerType.name == name))
    ).scalar_one_or_none()
    if customer_type is None:
        raise RuntimeError(
            f"Seed customer type {name!r} is missing — was it deleted outside the app?"
        )
    return customer_type.id
