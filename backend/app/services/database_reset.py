"""Wipes business/customer data for a fresh-install reset.

Deliberately scoped to leave auth (users/roles/permissions), site
settings, and integration credentials untouched — whoever triggers a
reset stays logged in and the app stays configured (SMS/email
credentials, branding, etc.) afterward. A truncate this broad is always
preceded by a `pg_dump` backup (see `backup_database`) so a mistaken
reset still has a last-resort recovery path; if the backup fails, the
reset must not proceed.
"""

import asyncio
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

# Every business-data table, in no particular order — TRUNCATE ... CASCADE
# handles FK dependencies, so ordering here is only for readability. Kept
# tables (users, roles, permissions, role_permissions,
# user_permission_overrides, site_settings, integration_credentials) are
# deliberately absent — see module docstring.
RESET_TABLES = [
    "import_row_errors",
    "import_batches",
    "customer_monthly_spending",
    "customer_profile_tokens",
    "campaign_recipients",
    "campaign_landing_pages",
    "campaigns",
    "message_templates",
    "deliveries",
    "gift_orders",
    "gift_catalog_items",
    "gift_categories",
    "forms",
    "customers",
]


class DatabaseBackupError(Exception):
    """Raised when the pre-reset pg_dump backup couldn't be created —
    callers must treat this as fatal and never proceed with the reset."""


async def backup_database(backup_dir: Path | None = None) -> Path:
    """Runs `pg_dump` against the configured database, writing a
    timestamped plain-SQL dump. Raises `DatabaseBackupError` (never lets a
    reset proceed) if `pg_dump` isn't on PATH or exits non-zero."""
    target_dir = backup_dir if backup_dir is not None else Path(settings.BACKUP_DIR)
    target_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    backup_path = target_dir / f"pre-reset-{timestamp}.sql"

    try:
        process = await asyncio.create_subprocess_exec(
            "pg_dump",
            settings.pg_dump_url,
            "-f",
            str(backup_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        raise DatabaseBackupError("pg_dump is not installed on this server") from exc

    _, stderr = await process.communicate()
    if process.returncode != 0:
        backup_path.unlink(missing_ok=True)
        raise DatabaseBackupError((stderr.decode(errors="replace") or "pg_dump failed")[:1000])

    return backup_path


async def reset_business_data(db: AsyncSession) -> None:
    """Truncates every table in `RESET_TABLES` and restarts their identity
    sequences, in a single statement so Postgres handles all the
    cross-table FK ordering via CASCADE atomically."""
    table_list = ", ".join(RESET_TABLES)
    await db.execute(text(f"TRUNCATE TABLE {table_list} RESTART IDENTITY CASCADE"))
    await db.commit()
