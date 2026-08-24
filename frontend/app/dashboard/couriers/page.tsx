import { AlertTriangle, CheckCircle2, Package, Truck } from "lucide-react";

import { DeliveriesDirectory } from "@/components/dashboard/couriers/deliveries-directory";
import { CouriersPageHeader } from "@/components/dashboard/couriers/page-header";
import { StatsGrid, type StatDefinition } from "@/components/dashboard/stats-grid";
import { getDeliveryStats, listDeliveries } from "@/lib/api/deliveries";

export default async function CouriersPage() {
  const [{ items: deliveries }, stats] = await Promise.all([
    listDeliveries(),
    getDeliveryStats(),
  ]);

  const statDefinitions: StatDefinition[] = [
    {
      key: "total",
      label: "Total Deliveries",
      value: stats.totalDeliveries,
      caption: "All courier shipments",
      icon: Package,
    },
    {
      key: "in-transit",
      label: "In Transit",
      value: stats.inTransitCount,
      caption: "On the way to customers",
      icon: Truck,
    },
    {
      key: "delivered",
      label: "Delivered",
      value: stats.deliveredCount,
      caption: "Successfully completed",
      icon: CheckCircle2,
    },
    {
      key: "issues",
      label: "Failed / Returned",
      value: stats.issuesCount,
      caption: "Needs attention",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <CouriersPageHeader />
      <StatsGrid stats={statDefinitions} />
      <DeliveriesDirectory deliveries={deliveries} />
    </div>
  );
}
