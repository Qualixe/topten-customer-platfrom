import nextDynamic from "next/dynamic";
import {
  Cake,
  CalendarDays,
  CalendarRange,
  Crown,
  FileCheck2,
  Gem,
  Inbox,
  PackageCheck,
  Send,
  UserRound,
  Users,
} from "lucide-react";

import { ChartCardSkeleton } from "@/components/dashboard/overview/chart-card-skeleton";
import { CustomerOverview } from "@/components/dashboard/overview/customer-overview";
import { HealthCircles } from "@/components/dashboard/overview/health-circles";
import { PageHeader } from "@/components/dashboard/overview/page-header";
import { RecentActivity } from "@/components/dashboard/overview/recent-activity";
import { TopGifts } from "@/components/dashboard/overview/top-gifts";
import { UpcomingBirthdays } from "@/components/dashboard/overview/upcoming-birthdays";
import { StatsSectionCard } from "@/components/dashboard/stats-section-card";
import type { StatDefinition } from "@/components/dashboard/stats-grid";
import { getCustomerStats, listRecentCustomers, listUpcomingBirthdays } from "@/lib/api/customers";
import { getDashboardOverview } from "@/lib/api/dashboard-overview";

// recharts is a heavy dependency (~90KB+ gzipped) used only by these three
// widgets — code-split so it doesn't block the rest of the (server-
// rendered, data-ready-immediately) page from painting first.
const SignupsChart = nextDynamic(
  () => import("@/components/dashboard/overview/signups-chart").then((m) => m.SignupsChart),
  { loading: () => <ChartCardSkeleton /> }
);
const GiftOrdersChart = nextDynamic(
  () => import("@/components/dashboard/overview/gift-orders-chart").then((m) => m.GiftOrdersChart),
  { loading: () => <ChartCardSkeleton /> }
);
const CustomerMixDonut = nextDynamic(
  () => import("@/components/dashboard/overview/customer-mix-donut").then((m) => m.CustomerMixDonut),
  { loading: () => <ChartCardSkeleton /> }
);

// Real, live data (customer/gift counts change constantly) — never
// statically cached.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, recentCustomers, upcomingBirthdays, overview] = await Promise.all([
    getCustomerStats(),
    listRecentCustomers(6),
    listUpcomingBirthdays(30),
    getDashboardOverview(),
  ]);

  const todayBirthdays = upcomingBirthdays.filter((birthday) => birthday.daysAway === 0).length;
  const thisWeekBirthdays = upcomingBirthdays.filter((birthday) => birthday.daysAway <= 6).length;

  const customerStats: StatDefinition[] = [
    {
      key: "total-customers",
      label: "Total Customer",
      value: stats.totalCustomers.toLocaleString(),
      icon: Users,
    },
    {
      key: "vip-customers",
      label: "VIP Customer",
      value: overview.customerMix.vip.toLocaleString(),
      icon: Crown,
    },
    {
      key: "regular-customers",
      label: "Regular Customer",
      value: overview.customerMix.general.toLocaleString(),
      icon: UserRound,
    },
    {
      key: "vvip-customers",
      label: "VVIP Customer",
      value: overview.customerMix.vvip.toLocaleString(),
      icon: Gem,
    },
  ];

  const birthdayStats: StatDefinition[] = [
    {
      key: "today-birthday",
      label: "Today Birthday",
      value: todayBirthdays.toLocaleString(),
      icon: Cake,
    },
    {
      key: "week-birthday",
      label: "This Week Birthday",
      value: thisWeekBirthdays.toLocaleString(),
      icon: CalendarDays,
    },
    {
      key: "month-birthday",
      label: "This Month Birthday",
      value: stats.birthdaysThisMonth.toLocaleString(),
      icon: CalendarRange,
    },
  ];

  const todayActivityStats: StatDefinition[] = [
    {
      key: "today-send",
      label: "Today Send",
      caption: "Campaign SMS sent today",
      value: overview.today.campaignSends.toLocaleString(),
      icon: Send,
    },
    {
      key: "today-received",
      label: "Today Received",
      caption: "Profile forms completed today",
      value: overview.today.formsReceived.toLocaleString(),
      icon: Inbox,
    },
    {
      key: "form-submitted",
      label: "Form Submitted",
      caption: "Same as Today Received",
      value: overview.today.formsReceived.toLocaleString(),
      icon: FileCheck2,
    },
    {
      key: "gift-delivered",
      label: "Gift Delivered",
      caption: "Gift orders sent today",
      value: overview.today.giftsDelivered.toLocaleString(),
      icon: PackageCheck,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader />

      {/* Each group is its own Card with stats tiled inside it */}
      <StatsSectionCard title="Customers" stats={customerStats} />
      <StatsSectionCard title="Birthdays" stats={birthdayStats} />
      <StatsSectionCard title="Today's Activity" stats={todayActivityStats} />

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

      {/* hidden for now — uncomment to restore */}
      {/* <div className="grid gap-4 lg:grid-cols-2">
        <RecentActivity recentCustomers={recentCustomers} />
      </div>
      <CustomerOverview customers={recentCustomers} /> */}
    </div>
  );
}
