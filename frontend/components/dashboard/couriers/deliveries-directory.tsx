"use client";

import { useMemo, useState } from "react";

import { DeliveriesTable } from "@/components/dashboard/couriers/deliveries-table";
import {
  DeliveriesToolbar,
  type CourierFilter,
  type StatusFilter,
} from "@/components/dashboard/couriers/deliveries-toolbar";
import { DeliveryDetailsDialog } from "@/components/dashboard/couriers/delivery-details-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Delivery } from "@/lib/api/deliveries";

export function DeliveriesDirectory({
  deliveries,
  canManage,
}: {
  deliveries: Delivery[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [courierFilter, setCourierFilter] = useState<CourierFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // Held by id (not the object itself) so the dialog shows fresh data after
  // a status update triggers `router.refresh()` and `deliveries` updates.
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const selectedDelivery = deliveries.find((delivery) => delivery.id === selectedDeliveryId) ?? null;

  const filteredDeliveries = useMemo(() => {
    const query = search.trim().toLowerCase();

    return deliveries.filter((delivery) => {
      const matchesQuery =
        query.length === 0 ||
        delivery.trackingNumber.toLowerCase().includes(query) ||
        delivery.customerName.toLowerCase().includes(query);
      const matchesCourier =
        courierFilter === "all" || delivery.courier === courierFilter;
      const matchesStatus =
        statusFilter === "all" || delivery.status === statusFilter;

      return matchesQuery && matchesCourier && matchesStatus;
    });
  }, [deliveries, search, courierFilter, statusFilter]);

  function handleViewDelivery(delivery: Delivery) {
    setSelectedDeliveryId(delivery.id);
    setDialogOpen(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deliveries</CardTitle>
        <CardDescription>
          Every gift shipment and its current courier status
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <DeliveriesToolbar
          search={search}
          onSearchChange={setSearch}
          courierFilter={courierFilter}
          onCourierFilterChange={setCourierFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />

        <DeliveriesTable
          deliveries={filteredDeliveries}
          onViewDelivery={handleViewDelivery}
        />

        <DeliveryDetailsDialog
          delivery={selectedDelivery}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          canManage={canManage}
        />
      </CardContent>
    </Card>
  );
}
