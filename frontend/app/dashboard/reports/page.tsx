import nextDynamic from "next/dynamic";
import {
  FileCheck2,
  Inbox,
  PackageCheck,
  Send,
} from "lucide-react";

import { ChartCardSkeleton } from "@/components/dashboard/overview/chart-card-skeleton";
import { HealthCircles } from "@/components/dashboard/overview/health-circles";
import { TopGifts } from "@/components/dashboard/overview/top-gifts";
import { UpcomingBirthdays } from "@/components/dashboard/overview/upcoming-birthdays";
import { ReportsPageHeader } from "@/components/dashboard/reports/page-header";
import { StatsSectionCard } from "@/components/dashboard/stats-section-card";
import type { StatDefinition } from "@/components/dashboard/stats-grid";
import { listUpcomingBirthdays } from "@/lib/api/customers";
import { getDashboardOverview } from "@/lib/api/dashboard-overview";

const GiftOrdersChart = nextDynamic(
  () => import("@/components/dashboard/overview/gift-orders-chart").then((m) => m.GiftOrdersChart),
  { loading: () => <ChartCardSkeleton /> }
);

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [upcomingBirthdays, overview] = await Promise.all([
    listUpcomingBirthdays(30),
    getDashboardOverview(),
  ]);

  const todayActivityStats: StatDefinition[] = [
    {
      key: "today-send",
      label: "Campaign SMS Sent",
      caption: "Today",
      value: overview.today.campaignSends.toLocaleString(),
      icon: Send,
    },
    {
      key: "today-received",
      label: "Profiles Completed",
      caption: "Today",
      value: overview.today.formsReceived.toLocaleString(),
      icon: Inbox,
    },
    {
      key: "form-submitted",
      label: "Forms Submitted",
      caption: "Today",
      value: overview.today.formsReceived.toLocaleString(),
      icon: FileCheck2,
    },
    {
      key: "gift-delivered",
      label: "Gifts Delivered",
      caption: "Today",
      value: overview.today.giftsDelivered.toLocaleString(),
      icon: PackageCheck,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ReportsPageHeader />

      <StatsSectionCard title="Today's Activity" stats={todayActivityStats} />

      <div className="grid gap-4 lg:grid-cols-3">
        <HealthCircles
          totalCustomers={overview.totalCustomers}
          profileCompleteCustomers={overview.profileCompleteCustomers}
          verifiedCustomers={overview.verifiedCustomers}
          vipCustomers={overview.vipCustomers}
        />
        <TopGifts gifts={overview.topGifts} />
        <GiftOrdersChart data={overview.giftOrdersByDay} total={overview.totalGiftOrders} />
      </div>

      <UpcomingBirthdays birthdays={upcomingBirthdays} />
    </div>
  );
}
