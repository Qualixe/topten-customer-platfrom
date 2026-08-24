from fastapi import APIRouter

from app.api.v1.endpoints import (
    couriers,
    customers,
    health,
    imports,
    notifications,
    public_profile,
    site_settings,
    sms_campaigns,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(imports.router, prefix="/imports", tags=["imports"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(couriers.router, prefix="/couriers", tags=["couriers"])
api_router.include_router(public_profile.router, prefix="/public", tags=["public"])
api_router.include_router(site_settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(sms_campaigns.router, prefix="/sms/campaigns", tags=["sms-campaigns"])
