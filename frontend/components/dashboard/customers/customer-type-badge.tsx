import { Gem, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CustomerTypeOption } from "@/lib/api/customer-types";

/** VIP/VVIP keep their special styling by name (campaign targeting already
 * treats them as fixed concepts — see `get_seed_customer_type_id`); any
 * other type, including General and admin-added ones, gets a neutral
 * outline badge showing its real name. */
export function CustomerTypeBadge({ customerType }: { customerType: CustomerTypeOption }) {
  if (customerType.name === "VVIP") {
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

  if (customerType.name === "VIP") {
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

  return <Badge variant="outline">{customerType.name}</Badge>;
}
