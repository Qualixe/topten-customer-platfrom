import { StatusPill, type StatusTone } from "@/components/dashboard/status-pill";
import type { GiftOrderStatus } from "@/lib/mock/gifts";

const STATUS_TONE: Record<GiftOrderStatus, StatusTone> = {
  Pending: "warning",
  Scheduled: "info",
  Sent: "success",
  Cancelled: "danger",
};

export function GiftStatusBadge({ status }: { status: GiftOrderStatus }) {
  return <StatusPill label={status} tone={STATUS_TONE[status]} />;
}
