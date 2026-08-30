import re

from pydantic import BaseModel, field_validator

_HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


class SiteLogoData(BaseModel):
    logo_url: str | None
    brand_color: str


class SiteLogoResponse(BaseModel):
    success: bool = True
    data: SiteLogoData
    meta: dict = {}


class BrandColorUpdate(BaseModel):
    brand_color: str

    @field_validator("brand_color")
    @classmethod
    def _valid_hex_color(cls, value: str) -> str:
        stripped = value.strip()
        if not _HEX_COLOR_PATTERN.match(stripped):
            raise ValueError("brand_color must be a hex color like #EF4444")
        return stripped.upper()
