"use client";

import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BirthdayCustomer } from "@/lib/api/birthdays";

export function BirthdayCalendar({
  customers,
  selectedDate,
  onSelectDate,
}: {
  customers: BirthdayCustomer[];
  selectedDate: Date | undefined;
  onSelectDate: (date: Date | undefined) => void;
}) {
  const vipDates: Date[] = [];
  const regularDates: Date[] = [];
  const seen = new Set<string>();

  for (const customer of customers) {
    const key = `${customer.nextOccurrence.getFullYear()}-${customer.nextOccurrence.getMonth()}-${customer.nextOccurrence.getDate()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const hasVip = customers.some(
      (c) =>
        c.nextOccurrence.getFullYear() === customer.nextOccurrence.getFullYear() &&
        c.nextOccurrence.getMonth() === customer.nextOccurrence.getMonth() &&
        c.nextOccurrence.getDate() === customer.nextOccurrence.getDate() &&
        c.tier === "VIP"
    );

    (hasVip ? vipDates : regularDates).push(customer.nextOccurrence);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar View</CardTitle>
        <CardDescription>
          Days with a dot have birthdays — click one to filter the table
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onSelectDate}
          defaultMonth={new Date()}
          modifiers={{ birthday: regularDates, vipBirthday: vipDates }}
          modifiersClassNames={{
            birthday:
              "relative after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
            vipBirthday:
              "relative after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-amber-500",
          }}
          className="w-full rounded-lg border p-2"
        />
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Birthday
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            VIP birthday
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
