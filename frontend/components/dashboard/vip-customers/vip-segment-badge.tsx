import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CustomerSegment } from "@/lib/api/vip-customers";

const SEGMENT_STYLES: Record<CustomerSegment, string> = {
  VVIP:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  VIP: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  GENERAL:
    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
};

const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  VVIP: "VVIP",
  VIP: "VIP",
  GENERAL: "General",
};

export function VipSegmentBadge({ segment }: { segment: CustomerSegment }) {
  return <Badge className={cn(SEGMENT_STYLES[segment])}>{SEGMENT_LABELS[segment]}</Badge>;
}
