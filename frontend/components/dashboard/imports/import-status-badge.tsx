import { StatusPill, type StatusTone } from "@/components/dashboard/status-pill";
import type { ImportBatchStatus } from "@/lib/api/imports";

const STATUS_TONE: Record<ImportBatchStatus, StatusTone> = {
  UPLOADED: "neutral",
  VALIDATING: "neutral",
  PROCESSING: "neutral",
  COMPLETED: "success",
  COMPLETED_WITH_ERRORS: "warning",
  FAILED: "danger",
  CANCELLED: "danger",
};

const STATUS_LABEL: Record<ImportBatchStatus, string> = {
  UPLOADED: "Uploaded",
  VALIDATING: "Validating",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  COMPLETED_WITH_ERRORS: "Completed with errors",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const LOADING_STATUSES: ImportBatchStatus[] = ["UPLOADED", "VALIDATING", "PROCESSING"];

export function ImportStatusBadge({ status }: { status: ImportBatchStatus }) {
  return (
    <StatusPill
      label={STATUS_LABEL[status]}
      tone={STATUS_TONE[status]}
      loading={LOADING_STATUSES.includes(status)}
    />
  );
}
