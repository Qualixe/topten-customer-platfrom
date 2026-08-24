import { StatusPill, type StatusTone } from "@/components/dashboard/status-pill";
import type { VipStatus } from "@/lib/mock/vip-customers";

const STATUS_TONE: Record<VipStatus, StatusTone> = {
  Active: "success",
  "At Risk": "warning",
  Inactive: "neutral",
};

export function VipStatusBadge({ status }: { status: VipStatus }) {
  return <StatusPill label={status} tone={STATUS_TONE[status]} />;
}
