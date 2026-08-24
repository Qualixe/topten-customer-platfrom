import { StatusPill, type StatusTone } from "@/components/dashboard/status-pill";
import type { CustomerStatus } from "@/lib/mock/customers";

const STATUS_TONE: Record<CustomerStatus, StatusTone> = {
  Active: "success",
  Inactive: "neutral",
  Suspended: "danger",
};

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return <StatusPill label={status} tone={STATUS_TONE[status]} />;
}
