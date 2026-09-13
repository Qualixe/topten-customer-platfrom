"""Customer type CRUD. Unlike app.services.gifts's category functions (which
this otherwise mirrors), there is no delete here — only an `is_active`
toggle, so a type stays permanently valid for existing customer/import-batch
history even after an admin retires it. The three `is_system` rows
(General/VIP/VVIP, seeded when this table replaced the old fixed enum) can
never be renamed or deactivated through the app, because SMS campaign
audience targeting resolves them by exact name (see
get_seed_customer_type_id_or_none below, used from
app.services.sms_campaigns_audience) and deliberately does not extend to
arbitrary admin-added types — but they aren't guaranteed to exist: a
Database Reset truncates this table outright (bypassing the
rename/deactivate guard, which only applies to normal updates) and
re-seeds them immediately after, yet an account whose reset predates that
fix can still be left with none of the three. Every lookup here treats
that as a real, non-crashing state rather than a bug — see
get_seed_customer_type_id_or_none's docstring."""

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
    VIP/VVIP concept, not a generic "anyone who isn't General" view.

    Either (or both) can legitimately not exist — an account that has
    replaced the three built-in types with its own taxonomy (e.g. after
    Database Reset before it re-seeded them, or one that never used the
    VIP/VVIP concept at all) — in which case this contributes nothing to
    the filter rather than erroring; "no VIP-tier type exists" and "no
    customers are VIP-tier" mean the same observable thing here."""
    return [
        type_id
        for type_id in (
            await get_seed_customer_type_id_or_none(db, "VIP"),
            await get_seed_customer_type_id_or_none(db, "VVIP"),
        )
        if type_id is not None
    ]


async def get_seed_customer_type_id_or_none(db: AsyncSession, name: str) -> int | None:
    """Resolves one of the three built-in type names ("General"/"VIP"/
    "VVIP") to its row id, or None if that type doesn't currently exist —
    which is a legitimate state (see module docstring: no delete, only
    is_active, but Database Reset truncates this table and — before it was
    fixed to re-seed afterward — could leave an account with none of the
    three at all), not a bug to crash on. Callers decide what "doesn't
    exist" means for them: an audience/filter query treats it as "matches
    nothing" (see app.services.sms_campaigns_audience.build_condition and
    get_vip_tier_type_ids above); only the new-customer-default path (see
    get_default_customer_type_id) needs a real fallback, since every
    customer must have *some* type."""
    customer_type = (
        await db.execute(select(CustomerType).where(CustomerType.name == name))
    ).scalar_one_or_none()
    return customer_type.id if customer_type is not None else None


async def get_default_customer_type_id(db: AsyncSession) -> int:
    """The type a new customer gets when none is explicitly chosen (manual
    "Add Customer" with the type left blank, and public form
    submissions/POS imports, which never specify one at all). Prefers the
    built-in "General" type — the common case for any account that hasn't
    reworked its type taxonomy — but falls back to whichever type is
    oldest (preferring an active one) for an account that has replaced all
    three built-ins with its own custom types. Only raises if the account
    has zero customer types of any kind, which normal use can't produce:
    every account starts with the three seeded ones, and there is no way
    to delete a type, only deactivate it."""
    general_id = await get_seed_customer_type_id_or_none(db, "General")
    if general_id is not None:
        return general_id

    fallback = (
        await db.execute(
            select(CustomerType).order_by(CustomerType.is_active.desc(), CustomerType.id).limit(1)
        )
    ).scalar_one_or_none()
    if fallback is None:
        raise RuntimeError("No customer types exist at all — cannot assign a default")
    return fallback.id
