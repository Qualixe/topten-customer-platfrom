import { StatusPill, type StatusTone } from "@/components/dashboard/status-pill";
import type { DeliveryStatus } from "@/lib/mock/deliveries";

const STATUS_TONE: Record<DeliveryStatus, StatusTone> = {
  "Pending Pickup": "neutral",
  "In Transit": "info",
  "Out for Delivery": "accent",
  Delivered: "success",
  Failed: "danger",
  Returned: "warning",
};

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return <StatusPill label={status} tone={STATUS_TONE[status]} />;
}
