import { Cake, CalendarDays, Crown, PartyPopper } from "lucide-react";

import { BirthdaysExplorer } from "@/components/dashboard/birthdays/birthdays-explorer";
import { BirthdaysPageHeader } from "@/components/dashboard/birthdays/page-header";
import { TodayBirthdays } from "@/components/dashboard/birthdays/today-birthdays";
import { UpcomingBirthdaysList } from "@/components/dashboard/birthdays/upcoming-birthdays-list";
import { StatsGrid, type StatDefinition } from "@/components/dashboard/stats-grid";
import { getBirthdaysOverview, listBirthdays } from "@/lib/api/birthdays";

export default async function BirthdaysPage() {
  const [{ items: birthdays }, overview] = await Promise.all([
    listBirthdays(),
    getBirthdaysOverview(),
  ]);

  const stats: StatDefinition[] = [
    {
      key: "today",
      label: "Today's Birthdays",
      value: overview.stats.todayCount,
      caption: "Celebrating today",
      icon: PartyPopper,
    },
    {
      key: "this-month",
      label: "This Month",
      value: overview.stats.thisMonthCount,
      caption: "Birthdays in August",
      icon: Cake,
    },
    {
      key: "upcoming",
      label: "Upcoming (30 days)",
      value: overview.stats.upcomingCount,
      caption: "Excluding today",
      icon: CalendarDays,
    },
    {
      key: "vip",
      label: "VIP Birthdays",
      value: overview.stats.vipThisMonthCount,
      caption: "VIP customers this month",
      icon: Crown,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <BirthdaysPageHeader />
      <StatsGrid stats={stats} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TodayBirthdays customers={overview.today} />
        <UpcomingBirthdaysList customers={overview.upcoming} />
      </div>
      <BirthdaysExplorer customers={birthdays} />
    </div>
  );
}
