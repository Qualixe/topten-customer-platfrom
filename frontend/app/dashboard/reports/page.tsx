import nextDynamic from "next/dynamic";
import {
  Cake,
  CalendarDays,
  CalendarRange,
  Crown,
  FileCheck2,
  Gift,
  Inbox,
  PackageCheck,
  PartyPopper,
  Send,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { CampaignHistory } from "@/components/dashboard/reports/campaign-history";
import { ChartCardSkeleton } from "@/components/dashboard/overview/chart-card-skeleton";
import { HealthCircles } from "@/components/dashboard/overview/health-circles";
import { TopGifts } from "@/components/dashboard/overview/top-gifts";
import { UpcomingBirthdays } from "@/components/dashboard/overview/upcoming-birthdays";
import { ReportsPageHeader } from "@/components/dashboard/reports/page-header";
import { StatsSectionCard } from "@/components/dashboard/stats-section-card";
import type { StatDefinition } from "@/components/dashboard/stats-grid";
import { getBirthdaysOverview } from "@/lib/api/birthdays";
import { listCampaigns } from "@/lib/api/campaigns";
import { listUpcomingBirthdays } from "@/lib/api/customers";
import { getDashboardOverview } from "@/lib/api/dashboard-overview";
import { settleOk } from "@/lib/api/settle";

const GiftOrdersChart = nextDynamic(
  () => import("@/components/dashboard/overview/gift-orders-chart").then((m) => m.GiftOrdersChart),
  { loading: () => <ChartCardSkeleton /> }
);

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [upcomingBirthdays, overview, birthdaysOverview, campaignsResult] = await Promise.all([
    listUpcomingBirthdays(30),
    getDashboardOverview(),
    getBirthdaysOverview(),
    // Reports has no permission gate of its own (unlike the Campaigns page)
    // — settleOk so a viewer without campaigns.view still gets every other
    // section instead of the whole page erroring out.
    settleOk(listCampaigns({ pageSize: 100 })),
  ]);
  const campaigns = campaignsResult?.items ?? [];
  const birthdayStats = birthdaysOverview.stats;
  const currentMonthName = new Date().toLocaleDateString("en-US", { month: "long" });
  // birthdaysOverview.all already covers a full year out (within_days=365),
  // sorted by proximity — no extra fetch needed for a coarser 3-month cut.
  const next3MonthsBirthdaysCount = birthdaysOverview.all.filter(
    (birthday) => birthday.daysAway <= 90
  ).length;

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

  const customerOverviewStats: StatDefinition[] = [
    {
      key: "total-customers",
      label: "Total Customers",
      value: overview.totalCustomers.toLocaleString(),
      icon: Users,
    },
    {
      key: "vip-customers",
      label: "VIP Customers",
      value: overview.vipCustomers.toLocaleString(),
      icon: Crown,
    },
    {
      key: "verified-customers",
      label: "Verified Customers",
      value: overview.verifiedCustomers.toLocaleString(),
      icon: ShieldCheck,
    },
    {
      key: "profile-complete",
      label: "Profile Complete",
      value: overview.profileCompleteCustomers.toLocaleString(),
      icon: UserCheck,
    },
    {
      key: "new-signups",
      label: "New Signups",
      caption: "Last 14 days",
      value: overview.totalSignups.toLocaleString(),
      icon: UserPlus,
    },
    {
      key: "total-gift-orders",
      label: "Gift Orders",
      caption: "Last 14 days",
      value: overview.totalGiftOrders.toLocaleString(),
      icon: Gift,
    },
  ];

  const birthdayOverviewStats: StatDefinition[] = [
    {
      key: "birthdays-today",
      label: "Today's Birthdays",
      caption: "Celebrating today",
      value: birthdayStats.todayCount.toLocaleString(),
      icon: PartyPopper,
    },
    {
      key: "birthdays-this-month",
      label: "This Month",
      caption: `Birthdays in ${currentMonthName}`,
      value: birthdayStats.thisMonthCount.toLocaleString(),
      icon: Cake,
    },
    {
      key: "birthdays-this-week",
      label: "This Week",
      caption: "Excluding today",
      value: birthdayStats.upcomingCount.toLocaleString(),
      icon: CalendarDays,
    },
    {
      key: "birthdays-vip",
      label: "VIP Birthdays",
      caption: "VIP customers this month",
      value: birthdayStats.vipThisMonthCount.toLocaleString(),
      icon: Crown,
    },
    {
      key: "birthdays-next-3-months",
      label: "Next 3 Months",
      caption: "Upcoming birthdays",
      value: next3MonthsBirthdaysCount.toLocaleString(),
      icon: CalendarRange,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ReportsPageHeader />

      <StatsSectionCard title="Today's Activity" stats={todayActivityStats} show_title={false}/>
      <StatsSectionCard title="Customer Overview" stats={customerOverviewStats} show_title={false}/>
      <StatsSectionCard title="Birthday Overview" stats={birthdayOverviewStats} show_title={false} />

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

      <CampaignHistory campaigns={campaigns} />
    </div>
  );
}
