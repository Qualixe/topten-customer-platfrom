"use client";

import { useMemo, useState } from "react";

import { VipDetailsDialog } from "@/components/dashboard/vip-customers/vip-details-dialog";
import { VipTable } from "@/components/dashboard/vip-customers/vip-table";
import {
  VipToolbar,
  type SegmentFilter,
  type StatusFilter,
} from "@/components/dashboard/vip-customers/vip-toolbar";
import type { VipCustomer } from "@/lib/api/vip-customers";

export function VipDirectory({ customers }: { customers: VipCustomer[] }) {
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<VipCustomer | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const segments = useMemo(
    () => [...new Set(customers.map((customer) => customer.segment))].sort((a, b) => a.localeCompare(b)),
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesQuery =
        query.length === 0 ||
        customer.name.toLowerCase().includes(query) ||
        (customer.email?.toLowerCase().includes(query) ?? false) ||
        customer.phone.includes(query);
      const matchesSegment =
        segmentFilter === "all" || customer.segment === segmentFilter;
      const matchesStatus =
        statusFilter === "all" || customer.status === statusFilter;

      return matchesQuery && matchesSegment && matchesStatus;
    });
  }, [customers, search, segmentFilter, statusFilter]);

  function handleViewCustomer(customer: VipCustomer) {
    setSelectedCustomer(customer);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <VipToolbar
        search={search}
        onSearchChange={setSearch}
        segments={segments}
        segmentFilter={segmentFilter}
        onSegmentFilterChange={setSegmentFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <VipTable customers={filteredCustomers} onViewCustomer={handleViewCustomer} />

      <VipDetailsDialog
        customer={selectedCustomer}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
