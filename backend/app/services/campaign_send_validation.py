"""Pre-send validation for EMAIL campaigns, and the single gate every path
that can start sending one must go through
(`queue_email_campaign_send`) — never call `send_campaign_messages.delay`
for an EMAIL campaign directly from anywhere else.
"""

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import ValidationAppError
from app.models.campaign import Campaign, CampaignChannel, CampaignStatus
from app.models.campaign_recipient import CampaignRecipient, CampaignRecipientStatus
from app.services.mailchimp_sync import campaign_credentials_missing_fields

# A campaign can only be (re-)sent from these statuses — DRAFT (never sent
# yet) or FAILED (a previous attempt didn't finish; already-SENT recipients
# are untouched and only the remaining PENDING ones are retried, see
# app.tasks.sms_campaigns._send_email_campaign). SCHEDULED/PROCESSING/
# COMPLETED/CANCELLED are all deliberately excluded — this is what makes a
# second "Send Campaign" click on an already-sending/sent campaign a no-op
# rather than a duplicate send.
_SENDABLE_STATUSES = (CampaignStatus.DRAFT.value, CampaignStatus.FAILED.value)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


async def validate_email_campaign_for_send(db: AsyncSession, campaign: Campaign) -> list[str]:
    """Human-readable reasons this campaign can't be sent right now — an
    empty list means it's ready. Never mutates anything; callers decide
    what to do with a failing campaign (report it, or refuse to send)."""
    errors: list[str] = []

    if campaign.channel != CampaignChannel.EMAIL.value:
        return ["Only EMAIL campaigns can be sent this way."]

    if campaign.status not in _SENDABLE_STATUSES:
        errors.append("This campaign has already been sent or is currently sending.")

    if campaign.recipients_resolved_at is None:
        errors.append("Recipient list is still being calculated — try again in a moment.")
    elif campaign.total_recipients == 0:
        errors.append("This campaign has no recipients.")
    else:
        pending_emails = (
            await db.execute(
                select(CampaignRecipient.email).where(
                    CampaignRecipient.campaign_id == campaign.id,
                    CampaignRecipient.status == CampaignRecipientStatus.PENDING.value,
                )
            )
        ).scalars().all()
        if not any(email and _EMAIL_RE.match(email) for email in pending_emails):
            errors.append("No recipients have a valid email address.")

    if not (campaign.message or "").strip():
        errors.append("This campaign has no email body yet.")

    if not (campaign.subject or "").strip():
        errors.append("This campaign has no email subject yet.")

    missing_credential_fields = await campaign_credentials_missing_fields(db)
    if missing_credential_fields:
        errors.append(
            "Email sending is not configured — set up Mailchimp (API key, Audience ID, "
            "From Name, and Reply-To email) in Settings first."
        )

    return errors


async def queue_email_campaign_send(db: AsyncSession, campaign: Campaign) -> None:
    """Validates, and if clean, atomically flips the campaign from
    DRAFT/FAILED to PROCESSING and enqueues the real send. Raises
    `ValidationAppError` (422) listing every blocking reason otherwise —
    nothing is queued in that case.

    Duplicate-send safety: the caller must have loaded `campaign` with a
    row lock (`SELECT ... FOR UPDATE`, see the `/send-email` endpoint) so
    two concurrent "Send Campaign" requests for the same campaign can't
    both observe a sendable status and both queue a send — the second
    request blocks until the first's transaction commits, then sees the
    now-PROCESSING status and fails validation instead."""
    errors = await validate_email_campaign_for_send(db, campaign)
    if errors:
        raise ValidationAppError(" ".join(errors))

    campaign.status = CampaignStatus.PROCESSING.value
    await db.commit()

    # Imported here rather than at module load — app.tasks.sms_campaigns
    # already imports from this module's sibling services, and importing
    # its Celery task at the top of this file would risk a circular import
    # depending on import order.
    from app.tasks.sms_campaigns import send_campaign_messages

    send_campaign_messages.delay(campaign.id)
