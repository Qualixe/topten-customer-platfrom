import { StatusPill, type StatusTone } from "@/components/dashboard/status-pill";
import type { NotificationStatus } from "@/lib/api/notifications";

const STATUS_TONE: Record<NotificationStatus, StatusTone> = {
  Delivered: "success",
  Sent: "info",
  Failed: "danger",
  Pending: "neutral",
};

export function NotificationStatusBadge({
  status,
}: {
  status: NotificationStatus;
}) {
  return <StatusPill label={status} tone={STATUS_TONE[status]} />;
}
