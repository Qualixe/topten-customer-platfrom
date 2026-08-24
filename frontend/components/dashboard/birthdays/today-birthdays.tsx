import { Cake, PartyPopper } from "lucide-react";

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

export function TodayBirthdays({
  customers,
}: {
  customers: BirthdayCustomer[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PartyPopper className="size-4 text-amber-500" aria-hidden="true" />
          Today&apos;s Birthdays
        </CardTitle>
        <CardDescription>Customers celebrating today</CardDescription>
      </CardHeader>
      <CardContent>
        {customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
            <Cake className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              No customer birthdays today.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {customers.map((customer) => (
              <div
                key={customer.id}
                className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/40"
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
                      <Badge
                        className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900 dark:text-amber-300"
                      >
                        VIP
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Turning {customer.turningAge} today
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
