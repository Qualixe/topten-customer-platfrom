import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CourierProvider, DeliveryStatus } from "@/lib/api/deliveries";

export type CourierFilter = CourierProvider | "all";
export type StatusFilter = DeliveryStatus | "all";

const COURIER_LABELS: Record<CourierFilter, string> = {
  all: "All Couriers",
  Pathao: "Pathao",
  RedX: "RedX",
  Paperfly: "Paperfly",
  "Sundarban Courier": "Sundarban Courier",
  eCourier: "eCourier",
};

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All Statuses",
  "Pending Pickup": "Pending Pickup",
  "In Transit": "In Transit",
  "Out for Delivery": "Out for Delivery",
  Delivered: "Delivered",
  Failed: "Failed",
  Returned: "Returned",
};

export function DeliveriesToolbar({
  search,
  onSearchChange,
  courierFilter,
  onCourierFilterChange,
  statusFilter,
  onStatusFilterChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  courierFilter: CourierFilter;
  onCourierFilterChange: (value: CourierFilter) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
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
          placeholder="Search by tracking number or customer…"
          className="pl-8"
          aria-label="Search deliveries"
        />
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={courierFilter}
          onValueChange={(value) => onCourierFilterChange(value as CourierFilter)}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by courier">
            <SelectValue>
              {(value: CourierFilter) => COURIER_LABELS[value]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Couriers</SelectItem>
            <SelectItem value="Pathao">Pathao</SelectItem>
            <SelectItem value="RedX">RedX</SelectItem>
            <SelectItem value="Paperfly">Paperfly</SelectItem>
            <SelectItem value="Sundarban Courier">Sundarban Courier</SelectItem>
            <SelectItem value="eCourier">eCourier</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(value) => onStatusFilterChange(value as StatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue>
              {(value: StatusFilter) => STATUS_LABELS[value]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Pending Pickup">Pending Pickup</SelectItem>
            <SelectItem value="In Transit">In Transit</SelectItem>
            <SelectItem value="Out for Delivery">Out for Delivery</SelectItem>
            <SelectItem value="Delivered">Delivered</SelectItem>
            <SelectItem value="Failed">Failed</SelectItem>
            <SelectItem value="Returned">Returned</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
