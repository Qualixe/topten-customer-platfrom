import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomerSegment, VipStatus } from "@/lib/api/vip-customers";

export type SegmentFilter = CustomerSegment | "all";
export type StatusFilter = VipStatus | "all";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All Statuses",
  Active: "Active",
  "At Risk": "At Risk",
  Inactive: "Inactive",
};

export function VipToolbar({
  search,
  onSearchChange,
  segments,
  segmentFilter,
  onSegmentFilterChange,
  statusFilter,
  onStatusFilterChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  /** Distinct segment names actually present among the fetched VIP
   * customers — derived client-side rather than fetched separately, so the
   * filter never lists a type with zero VIP customers. */
  segments: string[];
  segmentFilter: SegmentFilter;
  onSegmentFilterChange: (value: SegmentFilter) => void;
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
          value={segmentFilter}
          onValueChange={(value) => onSegmentFilterChange(value as SegmentFilter)}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by segment">
            <SelectValue>
              {(value: SegmentFilter) => (value === "all" ? "All Segments" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Segments</SelectItem>
            {segments.map((segment) => (
              <SelectItem key={segment} value={segment}>
                {segment}
              </SelectItem>
            ))}
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
