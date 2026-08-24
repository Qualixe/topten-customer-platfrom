from pydantic import BaseModel


class SiteLogoData(BaseModel):
    logo_url: str | None


class SiteLogoResponse(BaseModel):
    success: bool = True
    data: SiteLogoData
    meta: dict = {}
