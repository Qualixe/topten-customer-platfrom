import { AlertTriangle, Coins, Crown, Wallet } from "lucide-react";

import { VipCustomersPageHeader } from "@/components/dashboard/vip-customers/page-header";
import { VipDirectory } from "@/components/dashboard/vip-customers/vip-directory";
import { StatsGrid, type StatDefinition } from "@/components/dashboard/stats-grid";
import { formatCurrency, getVipCustomerStats, listVipCustomers } from "@/lib/api/vip-customers";

export default async function VipCustomersPage() {
  const [{ items: customers }, stats] = await Promise.all([
    listVipCustomers(),
    getVipCustomerStats(),
  ]);

  const statDefinitions: StatDefinition[] = [
    {
      key: "total",
      label: "Total VIP Customers",
      value: String(stats.totalCustomers),
      caption: "Across all VIP levels",
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
      caption: "Spending has slowed down",
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
