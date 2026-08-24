import { Cake, Crown, Users, Wallet } from "lucide-react";

import { CustomerOverview } from "@/components/dashboard/overview/customer-overview";
import { PageHeader } from "@/components/dashboard/overview/page-header";
import { RecentActivity } from "@/components/dashboard/overview/recent-activity";
import { UpcomingBirthdays } from "@/components/dashboard/overview/upcoming-birthdays";
import { StatsGrid, type StatDefinition } from "@/components/dashboard/stats-grid";
import {
  formatCurrency,
  getCustomerStats,
  listRecentCustomers,
  listUpcomingBirthdays,
} from "@/lib/api/customers";

export default async function DashboardPage() {
  const [stats, recentCustomers, upcomingBirthdays] = await Promise.all([
    getCustomerStats(),
    listRecentCustomers(6),
    listUpcomingBirthdays(30),
  ]);

  const statDefinitions: StatDefinition[] = [
    {
      key: "total-customers",
      label: "Total Customers",
      value: stats.totalCustomers.toLocaleString(),
      icon: Users,
    },
    {
      key: "vip-customers",
      label: "VIP Customers",
      value: stats.vipCustomers.toLocaleString(),
      icon: Crown,
    },
    {
      key: "birthdays-this-month",
      label: "Birthdays This Month",
      value: stats.birthdaysThisMonth.toLocaleString(),
      icon: Cake,
    },
    {
      key: "total-revenue",
      label: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      icon: Wallet,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader />
      <StatsGrid stats={statDefinitions} />
      <div className="grid gap-4 lg:grid-cols-2">
        <UpcomingBirthdays birthdays={upcomingBirthdays} />
        <RecentActivity recentCustomers={recentCustomers} />
      </div>
      <CustomerOverview customers={recentCustomers} />
    </div>
  );
}
