import { AlertTriangle, CheckCircle2, Package, Truck } from "lucide-react";

import { DeliveriesDirectory } from "@/components/dashboard/couriers/deliveries-directory";
import { CouriersPageHeader } from "@/components/dashboard/couriers/page-header";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { StatsGrid, type StatDefinition } from "@/components/dashboard/stats-grid";
import { getCurrentUserSafe } from "@/lib/api/auth";
import { getDeliveryStats, listDeliveries } from "@/lib/api/deliveries";

// Real, frequently-changing backend data — must not be statically cached.
export const dynamic = "force-dynamic";

export default async function CouriersPage() {
  const user = await getCurrentUserSafe();
  if (!user?.permissions.includes("couriers.view")) {
    return (
      <div className="flex flex-col gap-6">
        <PermissionDenied description="Ask an admin to grant you the View courier deliveries permission if you think this is a mistake." />
      </div>
    );
  }

  const canManage = user.permissions.includes("couriers.manage");

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
      <CouriersPageHeader canManage={canManage} />
      <StatsGrid stats={statDefinitions} />
      <DeliveriesDirectory deliveries={deliveries} canManage={canManage} />
    </div>
  );
}
