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

import { CustomerMixDonut } from "@/components/dashboard/overview/customer-mix-donut";
import { CustomerOverview } from "@/components/dashboard/overview/customer-overview";
import { GiftOrdersChart } from "@/components/dashboard/overview/gift-orders-chart";
import { HealthCircles } from "@/components/dashboard/overview/health-circles";
import { PageHeader } from "@/components/dashboard/overview/page-header";
import { RecentActivity } from "@/components/dashboard/overview/recent-activity";
import { SignupsChart } from "@/components/dashboard/overview/signups-chart";
import { TopGifts } from "@/components/dashboard/overview/top-gifts";
import { UpcomingBirthdays } from "@/components/dashboard/overview/upcoming-birthdays";
import { StatsGrid, type StatDefinition } from "@/components/dashboard/stats-grid";
import { getCustomerStats, listRecentCustomers, listUpcomingBirthdays } from "@/lib/api/customers";
import { getDashboardOverview } from "@/lib/api/dashboard-overview";

// Real, live data (customer/gift counts change constantly) — never
// statically cached.
export const dynamic = "force-dynamic";

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

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

      <div className="flex flex-col gap-3">
        <SectionLabel>Customers</SectionLabel>
        <StatsGrid stats={customerStats} />
      </div>

      <div className="flex flex-col gap-3">
        <SectionLabel>Birthdays</SectionLabel>
        <StatsGrid stats={birthdayStats} columns={3} />
      </div>

      <div className="flex flex-col gap-3">
        <SectionLabel>Today&apos;s Activity</SectionLabel>
        <StatsGrid stats={todayActivityStats} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <UpcomingBirthdays birthdays={upcomingBirthdays} />
        <RecentActivity recentCustomers={recentCustomers} />
      </div>
      <CustomerOverview customers={recentCustomers} />
    </div>
  );
}
