import { Crown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CustomerTier } from "@/lib/mock/customers";

export function CustomerTierBadge({ tier }: { tier: CustomerTier }) {
  if (tier === "VIP") {
    return (
      <Badge
        className={cn(
          "border-amber-200 bg-amber-50 text-amber-700",
          "dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
        )}
      >
        <Crown className="size-3" aria-hidden="true" />
        VIP
      </Badge>
    );
  }

  return <Badge variant="outline">Regular</Badge>;
}
