"""Syncs opted-in customers into a SendGrid Marketing List
(`sync_customers`) — never touches anyone who hasn't opted in. Email is
sent through Mailchimp instead (see app.services.mailchimp_sync); this
module is sync-only, letting an admin optionally also keep a SendGrid
List in sync alongside Mailchimp."""

from datetime import UTC, datetime
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.credentials import get_or_create_credential_row, merge_credential_data
from app.common.exceptions import ValidationAppError
from app.common.sendgrid_client import find_or_create_list, find_verified_sender, upsert_contact
from app.models.customer import Customer
from app.views.sendgrid_marketing import SyncItemResult, SyncReport

SENDGRID_PROVIDER = "sendgrid_marketing"

_REQUIRED_CREDENTIAL_FIELDS = (
    "api_key",
    "list_name",
    "from_name",
    "from_email",
    "reply_to_email",
)


async def _require_credentials(db: AsyncSession) -> dict:
    row = await get_or_create_credential_row(db, SENDGRID_PROVIDER)
    missing = [field for field in _REQUIRED_CREDENTIAL_FIELDS if not row.data.get(field)]
    if missing:
        raise ValidationAppError(
            "Save SendGrid Marketing credentials (API key, list name, from name, from email, "
            "and reply-to email) in Settings before syncing."
        )
    return row.data


async def _ensure_list(db: AsyncSession, data: dict) -> str:
    result = await find_or_create_list(api_key=data["api_key"], name=data["list_name"])
    if not result.success or not result.list_id:
        raise ValidationAppError(f"Unable to reach SendGrid: {result.message}")
    # Informational cache only — the list is always (re-)resolved by name
    # above, so a later change to `list_name` just finds/creates a
    # different list rather than silently syncing to a stale one.
    if data.get("list_id") != result.list_id:
        await merge_credential_data(db, SENDGRID_PROVIDER, {"list_id": result.list_id})
    return result.list_id


async def check_sender_verified(data: dict) -> bool:
    """Non-fatal status check for display only (see the credentials GET
    endpoint) — never raises. `api_key`/`from_email` not yet saved, a
    SendGrid API error, or no matching Sender Identity all read the same
    way here: not (yet) verified."""
    if not data.get("api_key") or not data.get("from_email"):
        return False
    try:
        result = await find_verified_sender(api_key=data["api_key"], from_email=data["from_email"])
    except httpx.HTTPError:
        return False
    return bool(result.success and result.verified)


async def sync_customers(db: AsyncSession, *, customer_ids: list[UUID]) -> SyncReport:
    data = await _require_credentials(db)
    list_id = await _ensure_list(db, data)

    eligible = (
        (
            await db.execute(
                select(Customer).where(
                    Customer.public_id.in_(customer_ids),
                    Customer.marketing_opt_in.is_(True),
                    Customer.email.is_not(None),
                )
            )
        )
        .scalars()
        .all()
    )

    items: list[SyncItemResult] = []
    for customer in eligible:
        result = await upsert_contact(
            api_key=data["api_key"],
            list_id=list_id,
            email=customer.email,  # type: ignore[arg-type]  # filtered non-null above
            first_name=customer.name,
            phone=customer.phone,
        )
        if result.success:
            customer.marketing_synced_at = datetime.now(UTC)
        items.append(
            SyncItemResult(
                customer_id=customer.public_id,
                email=customer.email or "",
                success=result.success,
                message=result.message,
            )
        )
    await db.commit()

    # Anything requested but not in `eligible` (no marketing_opt_in, or no
    # email on file) is reported too, rather than silently dropped — the
    # caller asked for it and deserves to know why it didn't happen.
    reached_ids = {customer.public_id for customer in eligible}
    for skipped_id in set(customer_ids) - reached_ids:
        items.append(
            SyncItemResult(
                customer_id=skipped_id,
                email="",
                success=False,
                message="Not eligible — needs marketing opt-in and a saved email address.",
            )
        )

    failed = sum(1 for item in items if not item.success)
    return SyncReport(total=len(items), synced=len(items) - failed, failed=failed, items=items)
