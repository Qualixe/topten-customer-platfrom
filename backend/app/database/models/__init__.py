"""Import every model module here so Alembic autogenerate (via
app.database.base.Base.metadata) can discover all tables."""

from app.database.models.campaign import AudienceRuleType, Campaign, CampaignStatus, CampaignType
from app.database.models.campaign_recipient import CampaignRecipient, CampaignRecipientStatus
from app.database.models.customer import Customer, CustomerStatus
from app.database.models.customer_monthly_spending import CustomerMonthlySpending
from app.database.models.customer_profile_token import CustomerProfileToken
from app.database.models.import_batch import ImportBatch, ImportBatchStatus
from app.database.models.import_row_error import ImportRowError
from app.database.models.integration_credential import IntegrationCredential
from app.database.models.site_settings import SiteSettings

__all__ = [
    "AudienceRuleType",
    "Campaign",
    "CampaignRecipient",
    "CampaignRecipientStatus",
    "CampaignStatus",
    "CampaignType",
    "Customer",
    "CustomerStatus",
    "CustomerMonthlySpending",
    "CustomerProfileToken",
    "ImportBatch",
    "ImportBatchStatus",
    "ImportRowError",
    "IntegrationCredential",
    "SiteSettings",
]
