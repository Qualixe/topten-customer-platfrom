import Link from "next/link";
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
import { EmptyState } from "@/components/ui/empty-state";
import type { UpcomingBirthday } from "@/lib/api/customers";

function daysAwayLabel(daysAway: number) {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  return `In ${daysAway} days`;
}

export function UpcomingBirthdays({ birthdays }: { birthdays: UpcomingBirthday[] }) {
  return (
    <Card className="flex flex-1 flex-col">
      <CardHeader>
        <CardTitle>Upcoming Birthdays</CardTitle>
        <CardDescription>Customers with a birthday in the next 30 days</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-1">
        {birthdays.length === 0 && (
          <EmptyState
            icon={Cake}
            title="No upcoming birthdays"
            description="Birthdays will appear here once customer dates of birth are on file."
            className="flex-1"
          />
        )}
        {birthdays.map((birthday) => (
          <div
            key={birthday.id}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
          >
            <Avatar>
              <AvatarFallback>{birthday.initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">
                  {birthday.name}
                </p>
                {birthday.tier === "VIP" && (
                  <Badge variant="secondary" className="shrink-0">
                    VIP
                  </Badge>
                )}
              </div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Cake className="size-3" aria-hidden="true" />
                {birthday.date}
              </p>
            </div>
            <Badge variant="outline" className="shrink-0">
              {daysAwayLabel(birthday.daysAway)}
            </Badge>
          </div>
        ))}
        <Link
          href="/dashboard/birthdays"
          className="mt-2 text-center text-sm font-medium text-primary hover:underline"
        >
          View all birthdays
        </Link>
      </CardContent>
    </Card>
  );
}
