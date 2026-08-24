"""Shared helpers for storing/reading per-provider integration credentials
(e.g. Bulk SMS BD, Pathao) — see `app.database.models.integration_credential`.
"""

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models.integration_credential import IntegrationCredential


class SecretFieldStatus(BaseModel):
    """A credential field whose value is never echoed back once saved —
    only whether it's currently set."""

    is_secret: bool = True
    is_set: bool


class PlainFieldStatus(BaseModel):
    """A non-secret credential field (e.g. a sender id or username) — safe
    to display as-is."""

    is_secret: bool = False
    value: str | None


async def get_or_create_credential_row(
    db: AsyncSession, provider: str
) -> IntegrationCredential:
    select_stmt = select(IntegrationCredential).where(IntegrationCredential.provider == provider)
    row = (await db.execute(select_stmt)).scalar_one_or_none()
    if row is not None:
        return row

    # Two concurrent callers (e.g. two campaigns resolving at once, both
    # reading the SMS rate for the first time) can both reach here having
    # seen no row — ON CONFLICT DO NOTHING makes creating it race-safe
    # instead of one of them raising a unique-constraint violation.
    insert_stmt = (
        pg_insert(IntegrationCredential)
        .values(provider=provider, data={})
        .on_conflict_do_nothing(index_elements=["provider"])
    )
    await db.execute(insert_stmt)
    await db.commit()

    return (await db.execute(select_stmt)).scalar_one()


async def merge_credential_data(
    db: AsyncSession, provider: str, updates: dict[str, str | None]
) -> dict[str, str | None]:
    """Applies a partial update to a provider's stored credentials and
    returns the resulting full data dict. Reassigns the whole `data` dict
    (rather than mutating it in place) so SQLAlchemy detects the change."""
    row = await get_or_create_credential_row(db, provider)
    new_data = {**row.data, **updates}
    row.data = new_data
    await db.commit()
    await db.refresh(row)
    return row.data
