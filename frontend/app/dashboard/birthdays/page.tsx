import { Cake, CalendarDays, Crown, PartyPopper } from "lucide-react";

import { BirthdaysExplorer } from "@/components/dashboard/birthdays/birthdays-explorer";
import { BirthdaysPageHeader } from "@/components/dashboard/birthdays/page-header";
import { TodayBirthdays } from "@/components/dashboard/birthdays/today-birthdays";
import { UpcomingBirthdaysList } from "@/components/dashboard/birthdays/upcoming-birthdays-list";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { StatsGrid, type StatDefinition } from "@/components/dashboard/stats-grid";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { getBirthdaysOverview } from "@/lib/api/birthdays";
import { settleOk } from "@/lib/api/settle";

// Real, per-request data (today's date, live customer birthdays) — must
// not be statically cached.
export const dynamic = "force-dynamic";

export default async function BirthdaysPage() {
  // Fired alongside the permission check instead of after it — halves the
  // number of sequential round trips this page needs before it can render.
  const [user, overviewResult] = await Promise.all([
    getCurrentUserSafeCached(),
    settleOk(getBirthdaysOverview()),
  ]);
  if (!user?.permissions.includes("customers.view")) {
    return (
      <div className="flex flex-col gap-6">
        <BirthdaysPageHeader />
        <PermissionDenied description="Ask an admin to grant you the View customers permission if you think this is a mistake." />
      </div>
    );
  }

  // Guaranteed defined here — the backend enforces the same permission
  // just checked above, so an authorized user's fetch cannot have failed.
  const { all: birthdays, today, upcoming, stats: birthdayStats } = overviewResult!;
  const currentMonthName = new Date().toLocaleDateString("en-US", { month: "long" });

  const stats: StatDefinition[] = [
    {
      key: "today",
      label: "Today's Birthdays",
      value: birthdayStats.todayCount,
      caption: "Celebrating today",
      icon: PartyPopper,
    },
    {
      key: "this-month",
      label: "This Month",
      value: birthdayStats.thisMonthCount,
      caption: `Birthdays in ${currentMonthName}`,
      icon: Cake,
    },
    {
      key: "upcoming",
      label: "This Week",
      value: birthdayStats.upcomingCount,
      caption: "Excluding today",
      icon: CalendarDays,
    },
    {
      key: "vip",
      label: "VIP Birthdays",
      value: birthdayStats.vipThisMonthCount,
      caption: "VIP customers this month",
      icon: Crown,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <BirthdaysPageHeader />
      <StatsGrid stats={stats} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TodayBirthdays customers={today} />
        <UpcomingBirthdaysList customers={upcoming} />
      </div>
      <BirthdaysExplorer customers={birthdays} />
    </div>
  );
}
