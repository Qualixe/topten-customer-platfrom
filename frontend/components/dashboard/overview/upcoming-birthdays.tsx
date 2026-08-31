import Link from "next/link";
import { ArrowRight, Cake, Crown, Gem } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { UpcomingBirthday } from "@/lib/api/customers";

function DaysChip({ daysAway }: { daysAway: number }) {
  const isToday = daysAway === 0;
  const isTomorrow = daysAway === 1;
  const isSoon = daysAway <= 3;

  const label = isToday ? "Today 🎉" : isTomorrow ? "Tomorrow" : `${daysAway}d`;

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
        isToday
          ? "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"
          : isSoon
            ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
            : "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
  );
}

function TierIcon({ tier }: { tier: UpcomingBirthday["tier"] }) {
  if (tier === "VIP")
    return <Crown className="size-3 text-amber-500" aria-label="VIP" />;
  return null;
}

export function UpcomingBirthdays({ birthdays }: { birthdays: UpcomingBirthday[] }) {
  // Show at most 8 in the widget
  const visible = birthdays.slice(0, 8);

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cake className="size-4 text-rose-500" aria-hidden="true" />
              Upcoming Birthdays
            </CardTitle>
            <CardDescription className="mt-0.5">
              Next 30 days · {birthdays.length} customer{birthdays.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Link
            href="/dashboard/birthdays"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {birthdays.length === 0 ? (
          <EmptyState
            icon={Cake}
            title="No upcoming birthdays"
            description="Birthdays appear once customer dates of birth are on file."
            className="py-10"
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((birthday) => (
              <li
                key={birthday.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
              >
                {/* Avatar */}
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback className="text-xs">{birthday.initials}</AvatarFallback>
                </Avatar>

                {/* Name + date */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium leading-tight">
                      {birthday.name}
                    </p>
                    <TierIcon tier={birthday.tier} />
                  </div>
                  <p className="text-xs text-muted-foreground">{birthday.date}</p>
                </div>

                {/* Days chip */}
                <DaysChip daysAway={birthday.daysAway} />
              </li>
            ))}
          </ul>
        )}

        {birthdays.length > 8 && (
          <div className="border-t px-4 py-2.5 text-center">
            <Link
              href="/dashboard/birthdays"
              className="text-xs font-medium text-primary hover:underline"
            >
              +{birthdays.length - 8} more — view all
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
