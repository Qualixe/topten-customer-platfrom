import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CustomerSegment } from "@/lib/api/vip-customers";

/** VIP/VVIP keep their special styling by name; any other segment
 * (General, or an admin-added type) gets a neutral badge with its real
 * name, since admins can add arbitrary customer types. */
export function VipSegmentBadge({ segment }: { segment: CustomerSegment }) {
  if (segment === "VVIP") {
    return (
      <Badge
        className={cn(
          "border-slate-300 bg-slate-100 text-slate-700",
          "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        )}
      >
        VVIP
      </Badge>
    );
  }

  if (segment === "VIP") {
    return (
      <Badge
        className={cn(
          "border-amber-200 bg-amber-50 text-amber-700",
          "dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
        )}
      >
        VIP
      </Badge>
    );
  }

  return (
    <Badge
      className={cn(
        "border-zinc-200 bg-zinc-50 text-zinc-600",
        "dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
      )}
    >
      {segment}
    </Badge>
  );
}
