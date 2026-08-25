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
import type { BirthdayCustomer } from "@/lib/api/birthdays";

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="p-0">
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
                        {customer.email ?? "No email on file"}
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
