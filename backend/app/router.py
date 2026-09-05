from fastapi import APIRouter, Depends

from app.common.dependencies import get_current_user
from app.controllers import (
    auth,
    couriers,
    customers,
    database_reset,
    forms,
    gifts,
    health,
    imports,
    mailchimp_marketing,
    message_templates,
    notification_log,
    notifications,
    public_profile,
    roles,
    sendgrid_marketing,
    site_settings,
    sms_campaigns,
    users,
)

api_router = APIRouter()

_protected = [Depends(get_current_user)]

api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(public_profile.router, prefix="/public", tags=["public"])
api_router.include_router(site_settings.public_router, prefix="/public", tags=["public"])

api_router.include_router(
    sendgrid_marketing.router, prefix="/sendgrid", tags=["sendgrid"], dependencies=_protected
)
api_router.include_router(
    mailchimp_marketing.router, prefix="/mailchimp", tags=["mailchimp"], dependencies=_protected
)
api_router.include_router(
    customers.router, prefix="/customers", tags=["customers"], dependencies=_protected
)
api_router.include_router(
    imports.router, prefix="/imports", tags=["imports"], dependencies=_protected
)
api_router.include_router(
    notification_log.router,
    prefix="/notifications",
    tags=["notifications"],
    dependencies=_protected,
)
api_router.include_router(
    notifications.router, prefix="/notifications", tags=["notifications"], dependencies=_protected
)
api_router.include_router(
    couriers.router, prefix="/couriers", tags=["couriers"], dependencies=_protected
)
api_router.include_router(
    site_settings.router, prefix="/settings", tags=["settings"], dependencies=_protected
)
api_router.include_router(
    sms_campaigns.router,
    prefix="/sms/campaigns",
    tags=["sms-campaigns"],
    dependencies=_protected,
)
api_router.include_router(users.router, prefix="/users", tags=["users"], dependencies=_protected)
api_router.include_router(roles.router, prefix="/roles", tags=["roles"], dependencies=_protected)
api_router.include_router(gifts.router, prefix="/gifts", tags=["gifts"], dependencies=_protected)
api_router.include_router(forms.router, prefix="/forms", tags=["forms"], dependencies=_protected)
api_router.include_router(
    message_templates.router,
    prefix="/message-templates",
    tags=["message-templates"],
    dependencies=_protected,
)
api_router.include_router(
    database_reset.router,
    prefix="/settings/database",
    tags=["database-reset"],
    dependencies=_protected,
)
