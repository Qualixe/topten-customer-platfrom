import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomerTypeOption } from "@/lib/api/customer-types";
import { MONTH_OPTIONS } from "@/lib/api/birthdays";

export type MonthFilter = string | "all";
export type CustomerTypeFilter = string | "all";

const MONTH_LABELS: Record<string, string> = {
  all: "All Months",
  ...Object.fromEntries(MONTH_OPTIONS.map((m) => [m.value, m.label])),
};

export function DateFilters({
  month,
  onMonthChange,
  customerType,
  onCustomerTypeChange,
  customerTypes,
  selectedDateLabel,
  onClearSelectedDate,
}: {
  month: MonthFilter;
  onMonthChange: (value: MonthFilter) => void;
  customerType: CustomerTypeFilter;
  onCustomerTypeChange: (value: CustomerTypeFilter) => void;
  customerTypes: CustomerTypeOption[];
  selectedDateLabel?: string;
  onClearSelectedDate: () => void;
}) {
  const customerTypeLabels: Record<string, string> = {
    all: "All Types",
    ...Object.fromEntries(customerTypes.map((t) => [t.id, t.name])),
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-2">
        <Select
          value={month}
          onValueChange={(value) => onMonthChange(value as MonthFilter)}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by month">
            <SelectValue>
              {(value: MonthFilter) => MONTH_LABELS[value]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {MONTH_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={customerType}
          onValueChange={(value) => onCustomerTypeChange(value as CustomerTypeFilter)}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by customer type">
            <SelectValue>
              {(value: string) => customerTypeLabels[value] ?? "All Types"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {customerTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedDateLabel && (
        <Button variant="outline" size="sm" onClick={onClearSelectedDate}>
          <X />
          {selectedDateLabel}
        </Button>
      )}
    </div>
  );
}
