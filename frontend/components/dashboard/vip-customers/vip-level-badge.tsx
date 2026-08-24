import { Crown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VipLevel } from "@/lib/mock/vip-customers";

const LEVEL_STYLES: Record<VipLevel, string> = {
  Platinum:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Gold:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  Silver:
    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
};

export function VipLevelBadge({ level }: { level: VipLevel }) {
  return (
    <Badge className={cn(LEVEL_STYLES[level])}>
      <Crown className="size-3" aria-hidden="true" />
      {level}
    </Badge>
  );
}
