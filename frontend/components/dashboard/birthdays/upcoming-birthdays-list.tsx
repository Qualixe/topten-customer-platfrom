import { Cake } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BirthdayCustomer } from "@/lib/mock/birthdays";

function daysAwayLabel(daysAway: number) {
  if (daysAway === 1) return "Tomorrow";
  return `In ${daysAway} days`;
}

export function UpcomingBirthdaysList({
  customers,
}: {
  customers: BirthdayCustomer[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Birthdays</CardTitle>
        <CardDescription>Next 30 days, excluding today</CardDescription>
      </CardHeader>
      <CardContent>
        {customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
            <Cake className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              No upcoming birthdays in the next 30 days.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {customers.map((customer) => (
              <div
                key={customer.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
              >
                <Avatar>
                  <AvatarFallback>{customer.initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {customer.name}
                    </p>
                    {customer.tier === "VIP" && (
                      <Badge variant="secondary" className="shrink-0">
                        VIP
                      </Badge>
                    )}
                  </div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Cake className="size-3" aria-hidden="true" />
                    {customer.dateLabel} · Turning {customer.turningAge}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {daysAwayLabel(customer.daysAway)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
