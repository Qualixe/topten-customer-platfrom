"""Schemas for GET /notifications and GET /notifications/stats — a read-only
log of every SMS TopTen has actually sent, fanned in from two real sources
(`CampaignRecipient` for campaign/birthday/VIP sends, `GiftOrder` for gift
sends). See app.services.notification_log for how the two are merged.

Email and WhatsApp are kept in `NotificationChannel` for forward
compatibility with the frontend's existing channel tabs, but nothing in this
codebase sends through either — every real record is SMS. Likewise
`NotificationType.ORDER_UPDATE` has no backing feature (no e-commerce order
pipeline exists) and will never be produced; it stays only so the frontend's
existing filter option keeps working (as an always-empty choice) rather than
needing to be ripped out.
"""

import enum
from datetime import datetime

from pydantic import BaseModel


class NotificationChannel(str, enum.Enum):
    SMS = "SMS"
    EMAIL = "Email"
    WHATSAPP = "WhatsApp"


class NotificationType(str, enum.Enum):
    BIRTHDAY_WISH = "Birthday Wish"
    GIFT_NOTIFICATION = "Gift Notification"
    CAMPAIGN = "Campaign"
    ORDER_UPDATE = "Order Update"
    VIP_REWARD = "VIP Reward"


class NotificationStatus(str, enum.Enum):
    DELIVERED = "Delivered"
    SENT = "Sent"
    FAILED = "Failed"
    PENDING = "Pending"


class NotificationRecord(BaseModel):
    id: str
    channel: NotificationChannel
    type: NotificationType
    recipient_name: str
    recipient_contact: str
    subject: str
    message: str
    status: NotificationStatus
    sent_at: datetime | None
    delivered_at: datetime | None
    failure_reason: str | None


class NotificationsMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class NotificationsListResponse(BaseModel):
    success: bool = True
    data: list[NotificationRecord]
    meta: NotificationsMeta


class NotificationStats(BaseModel):
    total: int
    delivered: int
    failed: int
    delivery_rate: int


class NotificationStatsResponse(BaseModel):
    success: bool = True
    data: NotificationStats
    meta: dict = {}
