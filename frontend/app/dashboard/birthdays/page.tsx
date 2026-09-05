import { Cake, CalendarDays, CalendarRange, Crown, PartyPopper } from "lucide-react";

import { BirthdaysExplorer } from "@/components/dashboard/birthdays/birthdays-explorer";
import { BirthdaysPageHeader } from "@/components/dashboard/birthdays/page-header";
import { TodayBirthdays } from "@/components/dashboard/birthdays/today-birthdays";
import { UpcomingBirthdaysList } from "@/components/dashboard/birthdays/upcoming-birthdays-list";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { StatsSectionCard } from "@/components/dashboard/stats-section-card";
import type { StatDefinition } from "@/components/dashboard/stats-grid";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { getBirthdaysOverview } from "@/lib/api/birthdays";
import { listCustomerTypes } from "@/lib/api/customer-types";
import { settleOk } from "@/lib/api/settle";

// Real, per-request data (today's date, live customer birthdays) — must
// not be statically cached.
export const dynamic = "force-dynamic";

export default async function BirthdaysPage() {
  // Fired alongside the permission check instead of after it — halves the
  // number of sequential round trips this page needs before it can render.
  const [user, overviewResult, customerTypesResult] = await Promise.all([
    getCurrentUserSafeCached(),
    settleOk(getBirthdaysOverview()),
    settleOk(listCustomerTypes()),
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
  const customerTypes = customerTypesResult!;
  const currentMonthName = new Date().toLocaleDateString("en-US", { month: "long" });
  // `birthdays` (the "all" list) already covers a full year out
  // (within_days=365 server-side), sorted by proximity — no extra fetch
  // needed for a coarser 3-month cut.
  const next3MonthsBirthdaysCount = birthdays.filter((customer) => customer.daysAway <= 90).length;

  const stats: StatDefinition[] = [
    {
      key: "today",
      label: "Today's Birthdays",
      value: birthdayStats.todayCount,
      caption: "Celebrating today",
      icon: PartyPopper,
    },
       {
      key: "upcoming",
      label: "This Week",
      value: birthdayStats.upcomingCount,
      caption: "Excluding today",
      icon: CalendarDays,
    },
    {
      key: "this-month",
      label: "This Month",
      value: birthdayStats.thisMonthCount,
      caption: `Birthdays in ${currentMonthName}`,
      icon: Cake,
    },
 
    {
      key: "next-3-months",
      label: "Next 3 Months",
      value: next3MonthsBirthdaysCount,
      caption: "Upcoming birthdays",
      icon: CalendarRange,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <BirthdaysPageHeader />
      <StatsSectionCard title="Birthdays" stats={stats} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TodayBirthdays customers={today} />
        <UpcomingBirthdaysList customers={upcoming} />
      </div>
      <BirthdaysExplorer
        customers={birthdays}
        customerTypes={customerTypes.filter((type) => type.isActive)}
      />
    </div>
  );
}
