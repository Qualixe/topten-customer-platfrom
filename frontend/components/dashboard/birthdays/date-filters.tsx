import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONTH_OPTIONS } from "@/lib/api/birthdays";

export type MonthFilter = string | "all";
export type TierFilter = "all" | "VIP" | "Regular";

const MONTH_LABELS: Record<string, string> = {
  all: "All Months",
  ...Object.fromEntries(MONTH_OPTIONS.map((m) => [m.value, m.label])),
};

const TIER_LABELS: Record<TierFilter, string> = {
  all: "All Tiers",
  VIP: "VIP",
  Regular: "Regular",
};

export function DateFilters({
  month,
  onMonthChange,
  tier,
  onTierChange,
  selectedDateLabel,
  onClearSelectedDate,
}: {
  month: MonthFilter;
  onMonthChange: (value: MonthFilter) => void;
  tier: TierFilter;
  onTierChange: (value: TierFilter) => void;
  selectedDateLabel?: string;
  onClearSelectedDate: () => void;
}) {
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
          value={tier}
          onValueChange={(value) => onTierChange(value as TierFilter)}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by tier">
            <SelectValue>
              {(value: TierFilter) => TIER_LABELS[value]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="VIP">VIP</SelectItem>
            <SelectItem value="Regular">Regular</SelectItem>
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
