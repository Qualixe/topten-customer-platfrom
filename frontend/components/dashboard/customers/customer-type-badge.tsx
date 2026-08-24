import { Gem, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CustomerType } from "@/lib/mock/customers";

export function CustomerTypeBadge({ customerType }: { customerType: CustomerType }) {
  if (customerType === "VVIP") {
    return (
      <Badge
        className={cn(
          "border-purple-200 bg-purple-50 text-purple-700",
          "dark:border-purple-900 dark:bg-purple-950 dark:text-purple-400"
        )}
      >
        <Gem className="size-3" aria-hidden="true" />
        VVIP
      </Badge>
    );
  }

  if (customerType === "VIP") {
    return (
      <Badge
        className={cn(
          "border-amber-200 bg-amber-50 text-amber-700",
          "dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
        )}
      >
        <Star className="size-3" aria-hidden="true" />
        VIP
      </Badge>
    );
  }

  return <Badge variant="outline">General</Badge>;
}
