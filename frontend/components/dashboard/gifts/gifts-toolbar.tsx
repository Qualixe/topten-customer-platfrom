import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GiftCategory, StockStatus } from "@/lib/mock/gifts";

export type CategoryFilter = GiftCategory | "all";
export type StockFilter = StockStatus | "all";

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "All Categories",
  "Food & Beverage": "Food & Beverage",
  "Home & Living": "Home & Living",
  "Beauty & Wellness": "Beauty & Wellness",
  Electronics: "Electronics",
  "Gift Vouchers": "Gift Vouchers",
  "Kids & Toys": "Kids & Toys",
};

const STOCK_LABELS: Record<StockFilter, string> = {
  all: "All Stock",
  "In Stock": "In Stock",
  "Low Stock": "Low Stock",
  "Out of Stock": "Out of Stock",
};

export function GiftsToolbar({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  stockFilter,
  onStockFilterChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  categoryFilter: CategoryFilter;
  onCategoryFilterChange: (value: CategoryFilter) => void;
  stockFilter: StockFilter;
  onStockFilterChange: (value: StockFilter) => void;
}) {
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
            <SelectValue>
              {(value: CategoryFilter) => CATEGORY_LABELS[value]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Food & Beverage">Food &amp; Beverage</SelectItem>
            <SelectItem value="Home & Living">Home &amp; Living</SelectItem>
            <SelectItem value="Beauty & Wellness">Beauty &amp; Wellness</SelectItem>
            <SelectItem value="Electronics">Electronics</SelectItem>
            <SelectItem value="Gift Vouchers">Gift Vouchers</SelectItem>
            <SelectItem value="Kids & Toys">Kids &amp; Toys</SelectItem>
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
            <SelectItem value="In Stock">In Stock</SelectItem>
            <SelectItem value="Low Stock">Low Stock</SelectItem>
            <SelectItem value="Out of Stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
