import { paginate, simulateNetworkDelay } from "@/lib/api/client";
import type { PaginatedResponse, PaginationParams } from "@/lib/api/types";
import {
  birthdaysThisMonth,
  mockBirthdayCustomers,
  todaysBirthdays,
  upcomingBirthdays,
  vipBirthdaysThisMonth,
  type BirthdayCustomer,
} from "@/lib/mock/birthdays";

export type { BirthdayCustomer, GiftStatus } from "@/lib/mock/birthdays";
export { MONTH_OPTIONS, REFERENCE_DATE } from "@/lib/mock/birthdays";

export interface BirthdayStats {
  todayCount: number;
  thisMonthCount: number;
  upcomingCount: number;
  vipThisMonthCount: number;
}

export interface BirthdaysOverview {
  today: BirthdayCustomer[];
  upcoming: BirthdayCustomer[];
  stats: BirthdayStats;
}

/**
 * Fetches a page of customer birthdays (the full year, for the calendar and
 * table views).
 *
 * Backed by in-memory mock data for now — swap for `apiFetch` once
 * `/birthdays` exists on the backend.
 */
export async function listBirthdays(
  params: PaginationParams = {}
): Promise<PaginatedResponse<BirthdayCustomer>> {
  await simulateNetworkDelay();
  return paginate(mockBirthdayCustomers, params);
}

/**
 * Fetches the "today" and "upcoming" buckets plus their stats in one call —
 * mirrors a purpose-built dashboard-overview endpoint rather than requiring
 * three separate round trips for one page section.
 */
export async function getBirthdaysOverview(): Promise<BirthdaysOverview> {
  await simulateNetworkDelay();
  return {
    today: todaysBirthdays,
    upcoming: upcomingBirthdays,
    stats: {
      todayCount: todaysBirthdays.length,
      thisMonthCount: birthdaysThisMonth.length,
      upcomingCount: upcomingBirthdays.length,
      vipThisMonthCount: vipBirthdaysThisMonth.length,
    },
  };
}
