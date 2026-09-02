import nextDynamic from "next/dynamic";
import {
  Cake,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  CheckCircle2,
  Gift,
  Megaphone,
  Clock,
  Package,
  UserCheck,
  UserRound,
  UserX,
  Users,
} from "lucide-react";

import { ChartCardSkeleton } from "@/components/dashboard/overview/chart-card-skeleton";
import { PageHeader } from "@/components/dashboard/overview/page-header";
import { StatsSectionCard } from "@/components/dashboard/stats-section-card";
import type { StatDefinition } from "@/components/dashboard/stats-grid";
import { getCustomerStats, listUpcomingBirthdays } from "@/lib/api/customers";
import { getCampaignStats } from "@/lib/api/campaigns";
import { getGiftStats } from "@/lib/api/gifts";
import { getDashboardOverview } from "@/lib/api/dashboard-overview";

// recharts is heavy — code-split so it doesn't block the server-rendered page.
const SignupsChart = nextDynamic(
  () => import("@/components/dashboard/overview/signups-chart").then((m) => m.SignupsChart),
  { loading: () => <ChartCardSkeleton /> }
);
const CustomerMixDonut = nextDynamic(
  () =>
    import("@/components/dashboard/overview/customer-mix-donut").then((m) => m.CustomerMixDonut),
  { loading: () => <ChartCardSkeleton /> }
);

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, upcomingBirthdays, overview, campaignStats, giftStats] = await Promise.all([
    getCustomerStats(),
    // 31 days covers Today / Tomorrow / This Week / This Month in one fetch.
    listUpcomingBirthdays(31),
    getDashboardOverview(),
    getCampaignStats(),
    getGiftStats(),
  ]);

  const todayBirthdays = upcomingBirthdays.filter((b) => b.daysAway === 0).length;
  const tomorrowBirthdays = upcomingBirthdays.filter((b) => b.daysAway === 1).length;
  const thisWeekBirthdays = upcomingBirthdays.filter((b) => b.daysAway <= 7).length;
  const thisMonthBirthdays = upcomingBirthdays.filter((b) => b.daysAway <= 31).length;

  const incompleteCustomers = stats.totalCustomers - overview.profileCompleteCustomers;

  // ── Customers ────────────────────────────────────────────────────────────
  const customerStats: StatDefinition[] = [
    {
      key: "total-customers",
      label: "Total Customers",
      value: stats.totalCustomers.toLocaleString(),
      icon: Users,
    },
    {
      key: "verified-customers",
      label: "Verified Customers",
      value: overview.verifiedCustomers.toLocaleString(),
      icon: UserCheck,
    },
    {
      key: "profile-complete",
      label: "Profile Complete",
      value: overview.profileCompleteCustomers.toLocaleString(),
      icon: CheckCircle2,
    },
    {
      key: "incomplete-customers",
      label: "Incomplete Profile",
      value: incompleteCustomers.toLocaleString(),
      icon: UserX,
    },
  ];

  // ── Campaigns ────────────────────────────────────────────────────────────
  const campaignStatDefs: StatDefinition[] = [
    {
      key: "total-campaigns",
      label: "Total Campaigns",
      value: campaignStats.total.toLocaleString(),
      icon: Megaphone,
    },
    {
      key: "scheduled-campaigns",
      label: "Scheduled",
      value: campaignStats.scheduled.toLocaleString(),
      icon: Clock,
    },
  ];

  // ── Gifts ─────────────────────────────────────────────────────────────────
  const giftStatDefs: StatDefinition[] = [
    {
      key: "gifts-sent",
      label: "Total Gifts Sent",
      value: giftStats.sentOrdersCount.toLocaleString(),
      icon: Gift,
    },
    {
      key: "gift-stock",
      label: "Total Gift Stock",
      value: giftStats.totalGiftsInCatalog.toLocaleString(),
      icon: Package,
    },
  ];

  // ── Birthdays ─────────────────────────────────────────────────────────────
  const birthdayStatDefs: StatDefinition[] = [
    {
      key: "birthday-today",
      label: "Today",
      value: todayBirthdays.toLocaleString(),
      icon: Cake,
    },
    {
      key: "birthday-tomorrow",
      label: "Tomorrow",
      value: tomorrowBirthdays.toLocaleString(),
      icon: CalendarDays,
    },
    {
      key: "birthday-week",
      label: "This Week",
      value: thisWeekBirthdays.toLocaleString(),
      icon: CalendarRange,
    },
    {
      key: "birthday-month",
      label: "This Month",
      value: thisMonthBirthdays.toLocaleString(),
      icon: CalendarClock,
    },
  ];

  // Merge campaigns + gifts into one row so they sit side-by-side
  const campaignsAndGifts: StatDefinition[] = [
    ...campaignStatDefs,
    ...giftStatDefs,
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader />

      <StatsSectionCard title="Customers" stats={customerStats} />
      <StatsSectionCard title="Campaigns & Gifts" stats={campaignsAndGifts} />
      <StatsSectionCard title="Birthdays" stats={birthdayStatDefs} />

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
