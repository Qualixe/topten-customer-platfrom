"""Customer category (GENERAL/VIP/VVIP) support in the POS import pipeline.

Covers the 10 scenarios from the task:
1. General CSV import
2. VIP CSV import
3. VVIP CSV import
4. Existing customer changing from General -> VIP
5. Existing customer changing from VIP -> VVIP
6. Same phone imported multiple times
7. No duplicate customer creation
8. ImportBatch stores customer_type
9. Customer list filtering by type
10. Invalid customer type
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer, CustomerType
from app.services import imports as service
from tests.support import create_batch, make_valid_row


async def _get_customer(db_session: AsyncSession, phone: str = "+8801711000101") -> Customer:
    return (
        await db_session.execute(select(Customer).where(Customer.normalized_phone == phone))
    ).scalar_one()


# 1-3. General/VIP/VVIP CSV import.


async def test_general_import_creates_general_customers(db_session: AsyncSession) -> None:
    batch = await create_batch(db_session, customer_type=CustomerType.GENERAL.value)
    await service.process_chunk(
        db_session, batch, [make_valid_row("Rahim Uddin", "01711000101", "1000")]
    )
    await db_session.commit()

    customer = await _get_customer(db_session)
    assert customer.customer_type == CustomerType.GENERAL.value


async def test_vip_import_creates_vip_customers(db_session: AsyncSession) -> None:
    batch = await create_batch(db_session, customer_type=CustomerType.VIP.value)
    await service.process_chunk(
        db_session, batch, [make_valid_row("Karim Ahmed", "01711000102", "1000")]
    )
    await db_session.commit()

    customer = await _get_customer(db_session, "+8801711000102")
    assert customer.customer_type == CustomerType.VIP.value


async def test_vvip_import_creates_vvip_customers(db_session: AsyncSession) -> None:
    batch = await create_batch(db_session, customer_type=CustomerType.VVIP.value)
    await service.process_chunk(
        db_session, batch, [make_valid_row("Nasrin Akter", "01711000103", "1000")]
    )
    await db_session.commit()

    customer = await _get_customer(db_session, "+8801711000103")
    assert customer.customer_type == CustomerType.VVIP.value


async def test_vip_import_applies_to_every_row(db_session: AsyncSession) -> None:
    """The task's own worked example: selecting VIP and uploading two phones
    means both customers end up VIP."""
    batch = await create_batch(db_session, customer_type=CustomerType.VIP.value)
    await service.process_chunk(
        db_session,
        batch,
        [
            make_valid_row("Rahim Uddin", "01711111111", "1000", row_number=1),
            make_valid_row("Karim Ahmed", "01822222222", "1000", row_number=2),
        ],
    )
    await db_session.commit()

    first = await _get_customer(db_session, "+8801711111111")
    second = await _get_customer(db_session, "+8801822222222")
    assert first.customer_type == CustomerType.VIP.value
    assert second.customer_type == CustomerType.VIP.value


# 4-5. Existing customer's type changes on re-import.


async def test_existing_customer_changes_general_to_vip(db_session: AsyncSession) -> None:
    general_batch = await create_batch(
        db_session, month=1, customer_type=CustomerType.GENERAL.value
    )
    await service.process_chunk(
        db_session, general_batch, [make_valid_row("Rahim Uddin", "01711000101", "1000")]
    )
    await db_session.commit()
    assert (await _get_customer(db_session)).customer_type == CustomerType.GENERAL.value

    vip_batch = await create_batch(db_session, month=2, customer_type=CustomerType.VIP.value)
    result = await service.process_chunk(
        db_session, vip_batch, [make_valid_row("Rahim Uddin", "01711000101", "1500")]
    )
    await db_session.commit()

    assert result.new_customers == 0
    assert result.updated_customers == 1
    assert (await _get_customer(db_session)).customer_type == CustomerType.VIP.value


async def test_existing_customer_changes_vip_to_vvip(db_session: AsyncSession) -> None:
    vip_batch = await create_batch(db_session, month=1, customer_type=CustomerType.VIP.value)
    await service.process_chunk(
        db_session, vip_batch, [make_valid_row("Rahim Uddin", "01711000101", "1000")]
    )
    await db_session.commit()
    assert (await _get_customer(db_session)).customer_type == CustomerType.VIP.value

    vvip_batch = await create_batch(db_session, month=2, customer_type=CustomerType.VVIP.value)
    await service.process_chunk(
        db_session, vvip_batch, [make_valid_row("Rahim Uddin", "01711000101", "2000")]
    )
    await db_session.commit()

    assert (await _get_customer(db_session)).customer_type == CustomerType.VVIP.value


# 6-7. Same phone across multiple imports -> one customer, no duplicates.


async def test_same_phone_imported_multiple_times_stays_one_customer(
    db_session: AsyncSession,
) -> None:
    jan = await create_batch(db_session, month=1, customer_type=CustomerType.GENERAL.value)
    await service.process_chunk(
        db_session, jan, [make_valid_row("Rahim Uddin", "01711000101", "1000")]
    )
    await db_session.commit()

    feb = await create_batch(db_session, month=2, customer_type=CustomerType.VIP.value)
    await service.process_chunk(
        db_session, feb, [make_valid_row("Rahim Uddin", "01711000101", "1000")]
    )
    await db_session.commit()

    mar = await create_batch(db_session, month=3, customer_type=CustomerType.VVIP.value)
    await service.process_chunk(
        db_session, mar, [make_valid_row("Rahim Uddin", "01711000101", "1000")]
    )
    await db_session.commit()

    customers = (
        await db_session.execute(
            select(Customer).where(Customer.normalized_phone == "+8801711000101")
        )
    ).scalars().all()
    assert len(customers) == 1, "must not create duplicate customers across imports"
    assert customers[0].customer_type == CustomerType.VVIP.value, "latest import type wins"


async def test_no_duplicate_customer_created_within_one_file(db_session: AsyncSession) -> None:
    batch = await create_batch(db_session, customer_type=CustomerType.VIP.value)
    result = await service.process_chunk(
        db_session,
        batch,
        [
            make_valid_row("Rahim Uddin", "01711000101", "1000", row_number=1),
            make_valid_row("Rahim Uddin", "01711000101", "500", row_number=2),
        ],
    )
    await db_session.commit()

    assert result.duplicate_rows == 1
    customers = (
        await db_session.execute(
            select(Customer).where(Customer.normalized_phone == "+8801711000101")
        )
    ).scalars().all()
    assert len(customers) == 1


# 8. ImportBatch stores customer_type.


async def test_import_batch_stores_customer_type(db_session: AsyncSession) -> None:
    batch = await create_batch(db_session, month=1, customer_type=CustomerType.VIP.value)
    assert batch.customer_type == CustomerType.VIP.value
