import { AlertTriangle, Coins, Crown, Wallet } from "lucide-react";

import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { StatsGrid, type StatDefinition } from "@/components/dashboard/stats-grid";
import { VipCustomersPageHeader } from "@/components/dashboard/vip-customers/page-header";
import { VipDirectory } from "@/components/dashboard/vip-customers/vip-directory";
import { getCurrentUserSafe } from "@/lib/api/auth";
import { formatCurrency, getVipCustomerStats, listVipCustomers } from "@/lib/api/vip-customers";

// Real, per-request data (live customer spending/status) — must not be
// statically cached.
export const dynamic = "force-dynamic";

export default async function VipCustomersPage() {
  const user = await getCurrentUserSafe();
  if (!user?.permissions.includes("customers.view")) {
    return (
      <div className="flex flex-col gap-6">
        <VipCustomersPageHeader />
        <PermissionDenied description="Ask an admin to grant you the View customers permission if you think this is a mistake." />
      </div>
    );
  }

  const [{ items: customers }, stats] = await Promise.all([
    listVipCustomers({ pageSize: 100 }),
    getVipCustomerStats(),
  ]);

  const statDefinitions: StatDefinition[] = [
    {
      key: "total",
      label: "Total VIP Customers",
      value: String(stats.totalCustomers),
      caption: "Customers flagged VIP",
      icon: Crown,
    },
    {
      key: "revenue",
      label: "Total VIP Revenue",
      value: formatCurrency(stats.totalRevenue),
      caption: "Lifetime spend, all VIPs",
      icon: Wallet,
    },
    {
      key: "average",
      label: "Avg. Spend per VIP",
      value: formatCurrency(stats.averageSpend),
      caption: "Lifetime spend average",
      icon: Coins,
    },
    {
      key: "at-risk",
      label: "At-Risk VIPs",
      value: String(stats.atRiskCount),
      caption: "No purchase in 2+ months",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <VipCustomersPageHeader />
      <StatsGrid stats={statDefinitions} />
      <VipDirectory customers={customers} />
    </div>
  );
}
