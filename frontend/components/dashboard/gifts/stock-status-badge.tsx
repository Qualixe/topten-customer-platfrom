import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StockStatus } from "@/lib/mock/gifts";

const STOCK_STYLES: Record<StockStatus, string> = {
  "In Stock":
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  "Low Stock":
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  "Out of Stock": "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30",
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  return <Badge className={cn(STOCK_STYLES[status])}>{status}</Badge>;
}
