import nextDynamic from "next/dynamic";
import {
  Cake,
  CalendarDays,
  CalendarRange,
  Crown,
  Gem,
  UserRound,
  Users,
} from "lucide-react";

import { ChartCardSkeleton } from "@/components/dashboard/overview/chart-card-skeleton";
import { PageHeader } from "@/components/dashboard/overview/page-header";
import { StatsSectionCard } from "@/components/dashboard/stats-section-card";
import type { StatDefinition } from "@/components/dashboard/stats-grid";
import { getCustomerStats, listUpcomingBirthdays } from "@/lib/api/customers";
import { getDashboardOverview } from "@/lib/api/dashboard-overview";

// recharts is heavy — code-split so it doesn't block the server-rendered page.
const SignupsChart = nextDynamic(
  () => import("@/components/dashboard/overview/signups-chart").then((m) => m.SignupsChart),
  { loading: () => <ChartCardSkeleton /> }
);
const CustomerMixDonut = nextDynamic(
  () => import("@/components/dashboard/overview/customer-mix-donut").then((m) => m.CustomerMixDonut),
  { loading: () => <ChartCardSkeleton /> }
);

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, upcomingBirthdays, overview] = await Promise.all([
    getCustomerStats(),
    listUpcomingBirthdays(30),
    getDashboardOverview(),
  ]);

  const todayBirthdays = upcomingBirthdays.filter((b) => b.daysAway === 0).length;
  const thisWeekBirthdays = upcomingBirthdays.filter((b) => b.daysAway <= 6).length;

  const customerStats: StatDefinition[] = [
    {
      key: "total-customers",
      label: "Total Customers",
      value: stats.totalCustomers.toLocaleString(),
      icon: Users,
    },
    {
      key: "vip-customers",
      label: "VIP Customers",
      value: overview.customerMix.vip.toLocaleString(),
      icon: Crown,
    },
    {
      key: "regular-customers",
      label: "Regular Customers",
      value: overview.customerMix.general.toLocaleString(),
      icon: UserRound,
    },
    {
      key: "vvip-customers",
      label: "VVIP Customers",
      value: overview.customerMix.vvip.toLocaleString(),
      icon: Gem,
    },
  ];

  const birthdayStats: StatDefinition[] = [
    {
      key: "today-birthday",
      label: "Today",
      value: todayBirthdays.toLocaleString(),
      icon: Cake,
    },
    {
      key: "week-birthday",
      label: "This Week",
      value: thisWeekBirthdays.toLocaleString(),
      icon: CalendarDays,
    },
    {
      key: "month-birthday",
      label: "This Month",
      value: stats.birthdaysThisMonth.toLocaleString(),
      icon: CalendarRange,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader />

      <StatsSectionCard title="Customers" stats={customerStats} />
      <StatsSectionCard title="Birthdays" stats={birthdayStats} />

      <div className="grid gap-4 lg:grid-cols-3 items-stretch">
        <div className="lg:col-span-2 flex flex-col">
          <SignupsChart data={overview.signupsByDay} total={overview.totalSignups} />
        </div>
        <CustomerMixDonut
          general={overview.customerMix.general}
          vip={overview.customerMix.vip}
          vvip={overview.customerMix.vvip}
        />
      </div>
    </div>
  );
}
