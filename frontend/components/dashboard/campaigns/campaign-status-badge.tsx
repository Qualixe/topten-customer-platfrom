import { StatusPill, type StatusTone } from "@/components/dashboard/status-pill";
import type { SmsCampaignStatus } from "@/lib/api/campaigns";

const STATUS_TONE: Record<SmsCampaignStatus, StatusTone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  PROCESSING: "accent",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "danger",
};

const STATUS_LABEL: Record<SmsCampaignStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export function CampaignStatusBadge({ status }: { status: SmsCampaignStatus }) {
  return (
    <StatusPill
      label={STATUS_LABEL[status]}
      tone={STATUS_TONE[status]}
      loading={status === "PROCESSING"}
    />
  );
}
