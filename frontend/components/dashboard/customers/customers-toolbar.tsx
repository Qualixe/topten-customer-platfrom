import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CityFilter,
  CustomerTypeFilter,
  SpendRangeFilter,
  StatusFilter,
} from "@/components/dashboard/customers/customers-url";
import { BD_DISTRICTS } from "@/lib/bd-districts";
import { listCustomerTypes, type CustomerTypeOption } from "@/lib/api/customer-types";
import { SPEND_RANGES } from "@/lib/spend-ranges";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All Statuses",
  Active: "Active",
  Inactive: "Inactive",
  Suspended: "Suspended",
};

export function CustomersToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  customerTypeFilter,
  onCustomerTypeFilterChange,
  cityFilter,
  onCityFilterChange,
  spendRangeFilter,
  onSpendRangeFilterChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  customerTypeFilter: CustomerTypeFilter;
  onCustomerTypeFilterChange: (value: CustomerTypeFilter) => void;
  cityFilter: CityFilter;
  onCityFilterChange: (value: CityFilter) => void;
  spendRangeFilter: SpendRangeFilter;
  onSpendRangeFilterChange: (value: SpendRangeFilter) => void;
}) {
  const [types, setTypes] = useState<CustomerTypeOption[]>([]);

  useEffect(() => {
    listCustomerTypes()
      .then(setTypes)
      .catch(() => {
        // Non-fatal — the filter just shows "All Types" only.
      });
  }, []);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-sm">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name, email, or phone…"
          className="pl-8"
          aria-label="Search customers"
        />
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={statusFilter}
          onValueChange={(value) => onStatusFilterChange(value as StatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by status">
            <SelectValue>
              {(value: StatusFilter) => STATUS_LABELS[value]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
            <SelectItem value="Suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={customerTypeFilter}
          onValueChange={(value) => onCustomerTypeFilterChange(value as CustomerTypeFilter)}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by customer type">
            <SelectValue>
              {(value: CustomerTypeFilter) =>
                value === "all" ? "All Types" : (types.find((t) => t.id === value)?.name ?? "…")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {types.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={cityFilter}
          onValueChange={(value) => onCityFilterChange(value as CityFilter)}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by city">
            <SelectValue>
              {(value: CityFilter) => (value === "all" ? "All Cities" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {BD_DISTRICTS.map((district) => (
              <SelectItem key={district} value={district}>
                {district}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={spendRangeFilter}
          onValueChange={(value) => onSpendRangeFilterChange(value as SpendRangeFilter)}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by spend range">
            <SelectValue>
              {(value: SpendRangeFilter) =>
                value === "all"
                  ? "All Spend"
                  : (SPEND_RANGES.find((range) => range.key === value)?.label ?? "…")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Spend</SelectItem>
            {SPEND_RANGES.map((range) => (
              <SelectItem key={range.key} value={range.key}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
