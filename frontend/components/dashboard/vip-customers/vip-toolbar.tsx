import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VipLevel, VipStatus } from "@/lib/mock/vip-customers";

export type LevelFilter = VipLevel | "all";
export type StatusFilter = VipStatus | "all";

const LEVEL_LABELS: Record<LevelFilter, string> = {
  all: "All Levels",
  Platinum: "Platinum",
  Gold: "Gold",
  Silver: "Silver",
};

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All Statuses",
  Active: "Active",
  "At Risk": "At Risk",
  Inactive: "Inactive",
};

export function VipToolbar({
  search,
  onSearchChange,
  levelFilter,
  onLevelFilterChange,
  statusFilter,
  onStatusFilterChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  levelFilter: LevelFilter;
  onLevelFilterChange: (value: LevelFilter) => void;
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
          placeholder="Search by name, email, or phone…"
          className="pl-8"
          aria-label="Search VIP customers"
        />
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={levelFilter}
          onValueChange={(value) => onLevelFilterChange(value as LevelFilter)}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by VIP level">
            <SelectValue>
              {(value: LevelFilter) => LEVEL_LABELS[value]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="Platinum">Platinum</SelectItem>
            <SelectItem value="Gold">Gold</SelectItem>
            <SelectItem value="Silver">Silver</SelectItem>
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
            <SelectItem value="At Risk">At Risk</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
