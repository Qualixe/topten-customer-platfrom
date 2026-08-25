import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STOCK_STATUS_LABELS, type StockStatus } from "@/lib/api/gifts";

const STOCK_STYLES: Record<StockStatus, string> = {
  IN_STOCK:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  LOW_STOCK:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  OUT_OF_STOCK: "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30",
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  return <Badge className={cn(STOCK_STYLES[status])}>{STOCK_STATUS_LABELS[status]}</Badge>;
}
