import { StatusPill, type StatusTone } from "@/components/dashboard/status-pill";
import type { GiftOrderStatus } from "@/lib/api/gifts";

const STATUS_TONE: Record<GiftOrderStatus, StatusTone> = {
  PENDING: "warning",
  SCHEDULED: "info",
  SENT: "success",
  CANCELLED: "danger",
};

const STATUS_LABEL: Record<GiftOrderStatus, string> = {
  PENDING: "Pending",
  SCHEDULED: "Scheduled",
  SENT: "Sent",
  CANCELLED: "Cancelled",
};

export function GiftStatusBadge({ status }: { status: GiftOrderStatus }) {
  return <StatusPill label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />;
}
