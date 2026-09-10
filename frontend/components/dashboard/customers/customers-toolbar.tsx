import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxSearchInput,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
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
import type { CustomersSortBy, SortDirection } from "@/lib/api/customers";
import { SPEND_RANGES } from "@/lib/spend-ranges";

const CITY_FILTER_ITEMS = ["all", ...BD_DISTRICTS];

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All Statuses",
  Active: "Active",
  Inactive: "Inactive",
  Suspended: "Suspended",
};

/** Each menu choice maps to the same server-side sort state used by the
 * sortable table headers. Keeping a single value makes choices such as A–Z
 * unambiguous and lets the selected sort survive a page reload. */
type CustomerSortOption =
  | "default"
  | "name-asc"
  | "name-desc"
  | "spend-desc"
  | "spend-asc"
  | "joined-desc"
  | "joined-asc";

const CUSTOMER_SORT_OPTIONS: Record<
  CustomerSortOption,
  { label: string; sortBy?: CustomersSortBy; sortDir: SortDirection }
> = {
  default: { label: "Default Order", sortDir: "asc" },
  "name-asc": { label: "Name (A–Z)", sortBy: "name", sortDir: "asc" },
  "name-desc": { label: "Name (Z–A)", sortBy: "name", sortDir: "desc" },
  "spend-desc": { label: "Total Spent (High–Low)", sortBy: "totalSpent", sortDir: "desc" },
  "spend-asc": { label: "Total Spent (Low–High)", sortBy: "totalSpent", sortDir: "asc" },
  "joined-desc": { label: "Joined (Newest First)", sortBy: "createdAt", sortDir: "desc" },
  "joined-asc": { label: "Joined (Oldest First)", sortBy: "createdAt", sortDir: "asc" },
};

function toCustomerSortOption(
  sortBy: CustomersSortBy | undefined,
  sortDir: SortDirection
): CustomerSortOption {
  const matched = (Object.entries(CUSTOMER_SORT_OPTIONS) as [
    CustomerSortOption,
    (typeof CUSTOMER_SORT_OPTIONS)[CustomerSortOption],
  ][]).find(([, option]) => option.sortBy === sortBy && option.sortDir === sortDir);

  return matched?.[0] ?? "default";
}

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
  sortBy,
  sortDir,
  onSortChange,
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
  sortBy: CustomersSortBy | undefined;
  sortDir: SortDirection;
  onSortChange: (sortBy: CustomersSortBy | undefined, sortDir: SortDirection) => void;
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

        <Combobox
          items={CITY_FILTER_ITEMS}
          value={cityFilter}
          onValueChange={(value) => onCityFilterChange((value as CityFilter) ?? "all")}
        >
          <ComboboxTrigger className="w-full sm:w-36" aria-label="Filter by city">
            <ComboboxValue>
              {(value: CityFilter) => (value === "all" ? "All Cities" : value)}
            </ComboboxValue>
          </ComboboxTrigger>
          <ComboboxContent>
            <ComboboxSearchInput placeholder="Search districts…" />
            <ComboboxEmpty>No district found.</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item}>
                  {item === "all" ? "All Cities" : item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>

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

        <Select
          value={toCustomerSortOption(sortBy, sortDir)}
          onValueChange={(value) => {
            const option = CUSTOMER_SORT_OPTIONS[value as CustomerSortOption];
            onSortChange(option.sortBy, option.sortDir);
          }}
        >
          <SelectTrigger className="w-full sm:w-52" aria-label="Sort customers">
            <SelectValue>
              {(value: CustomerSortOption) => CUSTOMER_SORT_OPTIONS[value].label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default Order</SelectItem>
            <SelectItem value="name-asc">Name (A–Z)</SelectItem>
            <SelectItem value="name-desc">Name (Z–A)</SelectItem>
            <SelectItem value="spend-desc">Total Spent (High–Low)</SelectItem>
            <SelectItem value="spend-asc">Total Spent (Low–High)</SelectItem>
            <SelectItem value="joined-desc">Joined (Newest First)</SelectItem>
            <SelectItem value="joined-asc">Joined (Oldest First)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
