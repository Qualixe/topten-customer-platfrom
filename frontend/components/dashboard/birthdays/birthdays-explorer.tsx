"use client";

import { useMemo, useState } from "react";

import { BirthdayCalendar } from "@/components/dashboard/birthdays/birthday-calendar";
import { BirthdayTable } from "@/components/dashboard/birthdays/birthday-table";
import {
  DateFilters,
  type MonthFilter,
  type TierFilter,
} from "@/components/dashboard/birthdays/date-filters";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BirthdayCustomer } from "@/lib/mock/birthdays";

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function BirthdaysExplorer({
  customers,
}: {
  customers: BirthdayCustomer[];
}) {
  const [month, setMonth] = useState<MonthFilter>("all");
  const [tier, setTier] = useState<TierFilter>("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesMonth =
        month === "all" || customer.birthMonth === Number(month);
      const matchesTier = tier === "all" || customer.tier === tier;
      const matchesDate =
        !selectedDate || isSameDate(customer.nextOccurrence, selectedDate);

      return matchesMonth && matchesTier && matchesDate;
    });
  }, [customers, month, tier, selectedDate]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <BirthdayCalendar
          customers={customers}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </div>

      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>All Birthdays</CardTitle>
            <CardDescription>
              Filter by month, tier, or a specific date from the calendar
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DateFilters
              month={month}
              onMonthChange={setMonth}
              tier={tier}
              onTierChange={setTier}
              selectedDateLabel={
                selectedDate
                  ? selectedDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : undefined
              }
              onClearSelectedDate={() => setSelectedDate(undefined)}
            />
            <BirthdayTable customers={filteredCustomers} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
