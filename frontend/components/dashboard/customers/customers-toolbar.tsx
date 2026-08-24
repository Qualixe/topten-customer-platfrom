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
  CustomerTypeFilter,
  StatusFilter,
  TierFilter,
} from "@/components/dashboard/customers/customers-url";

const TIER_LABELS: Record<TierFilter, string> = {
  all: "All Tiers",
  VIP: "VIP",
  Regular: "Regular",
};

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All Statuses",
  Active: "Active",
  Inactive: "Inactive",
  Suspended: "Suspended",
};

const CUSTOMER_TYPE_LABELS: Record<CustomerTypeFilter, string> = {
  all: "All Types",
  GENERAL: "General",
  VIP: "VIP",
  VVIP: "VVIP",
};

export function CustomersToolbar({
  search,
  onSearchChange,
  tierFilter,
  onTierFilterChange,
  statusFilter,
  onStatusFilterChange,
  customerTypeFilter,
  onCustomerTypeFilterChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  tierFilter: TierFilter;
  onTierFilterChange: (value: TierFilter) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  customerTypeFilter: CustomerTypeFilter;
  onCustomerTypeFilterChange: (value: CustomerTypeFilter) => void;
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
          placeholder="Search by name, email, or phone…"
          className="pl-8"
          aria-label="Search customers"
        />
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={tierFilter}
          onValueChange={(value) => onTierFilterChange(value as TierFilter)}
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
              {(value: CustomerTypeFilter) => CUSTOMER_TYPE_LABELS[value]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="GENERAL">General</SelectItem>
            <SelectItem value="VIP">VIP</SelectItem>
            <SelectItem value="VVIP">VVIP</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
