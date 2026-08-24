import { Cake, Crown } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { BirthdayCustomer, GiftStatus } from "@/lib/mock/birthdays";

const GIFT_STATUS_STYLES: Record<GiftStatus | "Not due yet", string> = {
  Sent: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  Scheduled:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-400",
  Pending: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  "Not due yet": "border-border bg-muted text-muted-foreground",
};

function daysAwayLabel(daysAway: number) {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  return `In ${daysAway} days`;
}

export function BirthdayTable({
  customers,
}: {
  customers: BirthdayCustomer[];
}) {
  return (
    <div className="rounded-lg border">
      <div className="max-h-[480px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Birthday</TableHead>
              <TableHead>Turning</TableHead>
              <TableHead>Days Away</TableHead>
              <TableHead>Gift Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    icon={Cake}
                    title="No birthdays found"
                    description="Try adjusting your month, tier, or date filter."
                  />
                </TableCell>
              </TableRow>
            )}
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>{customer.initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium">
                          {customer.name}
                        </p>
                        {customer.tier === "VIP" && (
                          <Crown
                            className="size-3.5 shrink-0 text-amber-500"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {customer.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {customer.dateLabel}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {customer.turningAge}
                </TableCell>
                <TableCell>
                  <Badge variant={customer.isToday ? "default" : "outline"}>
                    {daysAwayLabel(customer.daysAway)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                      GIFT_STATUS_STYLES[customer.giftStatus]
                    )}
                  >
                    {customer.giftStatus}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
