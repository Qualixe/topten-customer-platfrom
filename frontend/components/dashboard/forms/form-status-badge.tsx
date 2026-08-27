import { Badge } from "@/components/ui/badge";
import type { FormStatus } from "@/lib/form-builder/types";

const STATUS_CONFIG: Record<FormStatus, { label: string; variant: "default" | "secondary" }> = {
  PUBLISHED: { label: "Published", variant: "default" },
  DRAFT: { label: "Draft", variant: "secondary" },
};

export function FormStatusBadge({ status }: { status: FormStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
