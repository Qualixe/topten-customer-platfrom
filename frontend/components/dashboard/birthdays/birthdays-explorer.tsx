"use client";

import { useMemo, useState } from "react";

import { BirthdayCalendar } from "@/components/dashboard/birthdays/birthday-calendar";
import { BirthdayPagination } from "@/components/dashboard/birthdays/birthday-pagination";
import { BirthdayTable } from "@/components/dashboard/birthdays/birthday-table";
import {
  DateFilters,
  type CustomerTypeFilter,
  type MonthFilter,
} from "@/components/dashboard/birthdays/date-filters";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BirthdayCustomer } from "@/lib/api/birthdays";
import type { CustomerTypeOption } from "@/lib/api/customer-types";

const PAGE_SIZE = 10;

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function BirthdaysExplorer({
  customers,
  customerTypes,
}: {
  customers: BirthdayCustomer[];
  customerTypes: CustomerTypeOption[];
}) {
  const [month, setMonth] = useState<MonthFilter>("all");
  const [customerType, setCustomerType] = useState<CustomerTypeFilter>("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [page, setPage] = useState(1);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesMonth =
        month === "all" || customer.birthMonth === Number(month);
      const matchesCustomerType =
        customerType === "all" || customer.customerTypeId === customerType;
      const matchesDate =
        !selectedDate || isSameDate(customer.nextOccurrence, selectedDate);

      return matchesMonth && matchesCustomerType && matchesDate;
    });
  }, [customers, month, customerType, selectedDate]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedCustomers = filteredCustomers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function updateFilter<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <BirthdayCalendar
          customers={customers}
          selectedDate={selectedDate}
          onSelectDate={updateFilter(setSelectedDate)}
        />
      </div>

      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>All Birthdays</CardTitle>
            <CardDescription>
              Filter by month, customer type, or a specific date from the calendar
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DateFilters
              month={month}
              onMonthChange={updateFilter(setMonth)}
              customerType={customerType}
              onCustomerTypeChange={updateFilter(setCustomerType)}
              customerTypes={customerTypes}
              selectedDateLabel={
                selectedDate
                  ? selectedDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : undefined
              }
              onClearSelectedDate={() => updateFilter(setSelectedDate)(undefined)}
            />
            <BirthdayTable customers={pagedCustomers} />
            <BirthdayPagination
              page={currentPage}
              totalPages={totalPages}
              totalItems={filteredCustomers.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
