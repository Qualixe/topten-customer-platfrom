import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db, require_permission
from app.common.exceptions import ValidationAppError
from app.core.config import settings
from app.models.site_settings import SiteSettings
from app.views.site_settings import BrandColorUpdate, SiteLogoData, SiteLogoResponse

router = APIRouter()
# Just the logo's current URL — mounted unauthenticated (see app.router)
# under /public. It has to be, since the logo is shown on pages a logged-
# out visitor sees: /login, and the public customer/campaign profile pages.
# It's read-only and reveals nothing beyond a public branding image path,
# so this is safe to expose without auth.
public_router = APIRouter()

# Raster formats only — an uploaded SVG could carry an embedded <script>;
# rendering the logo via a plain <img> already prevents it from executing,
# but staying raster-only avoids the question entirely.
ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024

# The stored file's extension must come from the validated content-type, not
# the client-supplied filename — a request can pass the content-type check
# above while naming the file "x.html", which would then be served back by
# StaticFiles with a text/html content-type (stored-content-spoofing/XSS).
_EXTENSION_BY_CONTENT_TYPE = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}


async def _get_or_create_settings_row(db: AsyncSession) -> SiteSettings:
    row = (await db.execute(select(SiteSettings))).scalars().first()
    if row is None:
        row = SiteSettings()
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


def _logo_url(logo_path: str | None) -> str | None:
    if not logo_path:
        return None
    return f"/branding/{Path(logo_path).name}"


@public_router.get("/site-logo", response_model=SiteLogoResponse)
async def get_public_site_logo(db: AsyncSession = Depends(get_db)) -> SiteLogoResponse:
    row = await _get_or_create_settings_row(db)
    return SiteLogoResponse(
        data=SiteLogoData(logo_url=_logo_url(row.logo_path), brand_color=row.brand_color)
    )


@router.put("/brand-color", response_model=SiteLogoResponse)
async def update_brand_color(
    payload: BrandColorUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("settings.manage")),
) -> SiteLogoResponse:
    row = await _get_or_create_settings_row(db)
    row.brand_color = payload.brand_color
    await db.commit()
    await db.refresh(row)
    return SiteLogoResponse(
        data=SiteLogoData(logo_url=_logo_url(row.logo_path), brand_color=row.brand_color)
    )


@router.put("/logo", response_model=SiteLogoResponse)
async def upload_site_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("settings.manage")),
) -> SiteLogoResponse:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationAppError("Logo must be a PNG, JPEG, or WEBP image")

    contents = await file.read()
    if len(contents) > MAX_LOGO_SIZE_BYTES:
        raise ValidationAppError("Logo must be smaller than 2 MB")
    if not contents:
        raise ValidationAppError("Uploaded file is empty")

    upload_dir = Path(settings.BRANDING_UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    extension = _EXTENSION_BY_CONTENT_TYPE[file.content_type]
    destination = upload_dir / f"{uuid.uuid4()}{extension}"
    destination.write_bytes(contents)

    row = await _get_or_create_settings_row(db)

    previous_path = Path(row.logo_path) if row.logo_path else None

    row.logo_path = str(destination)
    await db.commit()
    await db.refresh(row)

    if previous_path and previous_path.exists():
        previous_path.unlink()

    return SiteLogoResponse(
        data=SiteLogoData(logo_url=_logo_url(row.logo_path), brand_color=row.brand_color)
    )


@router.delete("/logo", response_model=SiteLogoResponse)
async def remove_site_logo(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_permission("settings.manage")),
) -> SiteLogoResponse:
    row = await _get_or_create_settings_row(db)

    if row.logo_path:
        old_path = Path(row.logo_path)
        row.logo_path = None
        await db.commit()
        if old_path.exists():
            old_path.unlink()

    return SiteLogoResponse(data=SiteLogoData(logo_url=None, brand_color=row.brand_color))
