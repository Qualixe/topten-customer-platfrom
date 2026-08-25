import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STOCK_STATUS_LABELS,
  type GiftCategoryOption,
  type StockStatus,
} from "@/lib/api/gifts";

export type CategoryFilter = string | "all";
export type StockFilter = StockStatus | "all";

const STOCK_LABELS: Record<StockFilter, string> = {
  all: "All Stock",
  ...STOCK_STATUS_LABELS,
};

export function GiftsToolbar({
  search,
  onSearchChange,
  categories,
  categoryFilter,
  onCategoryFilterChange,
  stockFilter,
  onStockFilterChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  categories: GiftCategoryOption[];
  categoryFilter: CategoryFilter;
  onCategoryFilterChange: (value: CategoryFilter) => void;
  stockFilter: StockFilter;
  onStockFilterChange: (value: StockFilter) => void;
}) {
  const categoryLabel =
    categoryFilter === "all"
      ? "All Categories"
      : (categories.find((category) => category.id === categoryFilter)?.name ?? "All Categories");

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
          placeholder="Search gifts by name…"
          className="pl-8"
          aria-label="Search gifts"
        />
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={categoryFilter}
          onValueChange={(value) => onCategoryFilterChange(value as CategoryFilter)}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
            <SelectValue>{() => categoryLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={stockFilter}
          onValueChange={(value) => onStockFilterChange(value as StockFilter)}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by stock">
            <SelectValue>{(value: StockFilter) => STOCK_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock</SelectItem>
            {(Object.entries(STOCK_STATUS_LABELS) as [StockStatus, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
