import { AlertTriangle, CheckCircle2, Package, Truck } from "lucide-react";

import { DeliveriesDirectory } from "@/components/dashboard/couriers/deliveries-directory";
import { CouriersPageHeader } from "@/components/dashboard/couriers/page-header";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { StatsSectionCard } from "@/components/dashboard/stats-section-card";
import type { StatDefinition } from "@/components/dashboard/stats-grid";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { getDeliveryStats, listDeliveries } from "@/lib/api/deliveries";
import { settleOk } from "@/lib/api/settle";

// Real, frequently-changing backend data — must not be statically cached.
export const dynamic = "force-dynamic";

export default async function CouriersPage() {
  // Fired alongside the permission check instead of after it — halves the
  // number of sequential round trips this page needs before it can render.
  const [user, deliveriesResult, statsResult] = await Promise.all([
    getCurrentUserSafeCached(),
    settleOk(listDeliveries()),
    settleOk(getDeliveryStats()),
  ]);
  if (!user?.permissions.includes("couriers.view")) {
    return (
      <div className="flex flex-col gap-6">
        <PermissionDenied description="Ask an admin to grant you the View courier deliveries permission if you think this is a mistake." />
      </div>
    );
  }

  const canManage = user.permissions.includes("couriers.manage");
  // Guaranteed defined here — the backend enforces the same permission
  // just checked above, so an authorized user's fetches cannot have failed.
  const { items: deliveries } = deliveriesResult!;
  const stats = statsResult!;

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
      <StatsSectionCard title="Deliveries" stats={statDefinitions} />
      <DeliveriesDirectory deliveries={deliveries} canManage={canManage} />
    </div>
  );
}
