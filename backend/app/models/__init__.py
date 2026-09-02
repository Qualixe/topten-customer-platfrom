"""Import every model module here so Alembic autogenerate (via
app.models.base.Base.metadata) can discover all tables."""

from app.models.campaign import (
    AudienceRuleType,
    Campaign,
    CampaignChannel,
    CampaignStatus,
    CampaignType,
)
from app.models.campaign_landing_page import CampaignLandingPage
from app.models.campaign_recipient import (
    CampaignRecipient,
    CampaignRecipientStatus,
    VerificationStatus,
)
from app.models.customer import Customer, CustomerStatus
from app.models.customer_monthly_spending import CustomerMonthlySpending
from app.models.customer_profile_token import CustomerProfileToken
from app.models.delivery import CourierProvider, Delivery, DeliveryStatus
from app.models.form import Form, FormStatus
from app.models.gift_catalog_item import GiftCatalogItem
from app.models.gift_category import GiftCategory
from app.models.gift_order import GiftOccasion, GiftOrder, GiftOrderStatus
from app.models.import_batch import ImportBatch, ImportBatchStatus
from app.models.import_row_error import ImportRowError
from app.models.integration_credential import IntegrationCredential
from app.models.message_template import MessageTemplate, MessageTemplateChannel
from app.models.permission import Permission
from app.models.role import Role, role_permissions
from app.models.sendgrid_campaign import SendGridCampaign, SendGridCampaignStatus
from app.models.site_settings import SiteSettings
from app.models.user import User
from app.models.user_permission_override import UserPermissionOverride

__all__ = [
    "AudienceRuleType",
    "Campaign",
    "CampaignChannel",
    "CampaignLandingPage",
    "CampaignRecipient",
    "CampaignRecipientStatus",
    "CampaignStatus",
    "CampaignType",
    "Customer",
    "CustomerStatus",
    "CustomerMonthlySpending",
    "CustomerProfileToken",
    "CourierProvider",
    "Delivery",
    "DeliveryStatus",
    "Form",
    "FormStatus",
    "GiftCatalogItem",
    "GiftCategory",
    "GiftOccasion",
    "GiftOrder",
    "GiftOrderStatus",
    "ImportBatch",
    "ImportBatchStatus",
    "ImportRowError",
    "IntegrationCredential",
    "MessageTemplate",
    "MessageTemplateChannel",
    "Permission",
    "Role",
    "SendGridCampaign",
    "SendGridCampaignStatus",
    "SiteSettings",
    "User",
    "UserPermissionOverride",
    "VerificationStatus",
    "role_permissions",
]
