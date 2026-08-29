import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NotificationStatus, NotificationType } from "@/lib/api/notifications";

export type StatusFilter = NotificationStatus | "all";
export type TypeFilter = NotificationType | "all";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All Statuses",
  Delivered: "Delivered",
  Sent: "Sent",
  Failed: "Failed",
  Pending: "Pending",
};

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "All Types",
  "Birthday Wish": "Birthday Wish",
  "Gift Notification": "Gift Notification",
  Campaign: "Campaign",
  "Order Update": "Order Update",
  "VIP Reward": "VIP Reward",
};

export function NotificationsToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  typeFilter: TypeFilter;
  onTypeFilterChange: (value: TypeFilter) => void;
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
          placeholder="Search by recipient or subject…"
          className="pl-8"
          aria-label="Search notifications"
        />
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={typeFilter}
          onValueChange={(value) => onTypeFilterChange(value as TypeFilter)}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by type">
            <SelectValue>{(value: TypeFilter) => TYPE_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Birthday Wish">Birthday Wish</SelectItem>
            <SelectItem value="Gift Notification">Gift Notification</SelectItem>
            <SelectItem value="Campaign">Campaign</SelectItem>
            <SelectItem value="Order Update">Order Update</SelectItem>
            <SelectItem value="VIP Reward">VIP Reward</SelectItem>
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
            <SelectItem value="Delivered">Delivered</SelectItem>
            <SelectItem value="Sent">Sent</SelectItem>
            <SelectItem value="Failed">Failed</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
