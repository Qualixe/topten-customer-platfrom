import { apiGet } from "@/lib/api/client";
import type { ApiListEnvelope } from "@/lib/api/types";

export type CustomerTier = "VIP" | "Regular";

export interface BirthdayCustomer {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  tier: CustomerTier;
  customerTypeId: string;
  customerTypeName: string;
  birthMonth: number;
  birthDay: number;
  turningAge: number;
  nextOccurrence: Date;
  dateLabel: string;
  daysAway: number;
  isToday: boolean;
}

export interface BirthdayStats {
  todayCount: number;
  thisMonthCount: number;
  upcomingCount: number;
  vipThisMonthCount: number;
}

export interface BirthdaysOverview {
  /** Every customer with a known date of birth, sorted by proximity to
   * their next birthday — the full-year set the calendar/table explore. */
  all: BirthdayCustomer[];
  today: BirthdayCustomer[];
  upcoming: BirthdayCustomer[];
  stats: BirthdayStats;
}

interface UpcomingBirthdayDto {
  id: string;
  name: string;
  email: string | null;
  isVip: boolean;
  customerType: { id: string; name: string };
  /** Full date of birth, "YYYY-MM-DD" (year included). */
  date: string;
  daysAway: number;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function getInitials(name: string): string {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "?";
}

function enrich(dto: UpcomingBirthdayDto, today: Date): BirthdayCustomer {
  const birthYear = Number(dto.date.split("-")[0]);

  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const nextOccurrence = new Date(todayMidnight);
  nextOccurrence.setDate(todayMidnight.getDate() + dto.daysAway);

  return {
    id: dto.id,
    name: dto.name,
    initials: getInitials(dto.name),
    email: dto.email,
    tier: dto.isVip ? "VIP" : "Regular",
    customerTypeId: dto.customerType.id,
    customerTypeName: dto.customerType.name,
    birthMonth: nextOccurrence.getMonth() + 1,
    birthDay: nextOccurrence.getDate(),
    turningAge: nextOccurrence.getFullYear() - birthYear,
    nextOccurrence,
    dateLabel: `${MONTH_LABELS[nextOccurrence.getMonth()]} ${nextOccurrence.getDate()}`,
    daysAway: dto.daysAway,
    isToday: dto.daysAway === 0,
  };
}

/**
 * Fetches every customer with a known date of birth (via `within_days=365`
 * — a full year out covers everyone) and derives the today/upcoming
 * buckets and stats from that single list, rather than three separate
 * round trips for one page.
 */
export async function getBirthdaysOverview(): Promise<BirthdaysOverview> {
  const envelope = await apiGet<ApiListEnvelope<UpcomingBirthdayDto>>(
    "/customers/upcoming-birthdays?within_days=365"
  );

  const today = new Date();
  const all = envelope.data
    .map((dto) => enrich(dto, today))
    .sort((a, b) => a.daysAway - b.daysAway);

  const todayList = all.filter((c) => c.isToday);
  const upcoming = all.filter((c) => !c.isToday && c.daysAway <= 7);
  const thisMonth = today.getMonth() + 1;
  const thisMonthCustomers = all.filter((c) => c.birthMonth === thisMonth);

  return {
    all,
    today: todayList,
    upcoming,
    stats: {
      todayCount: todayList.length,
      thisMonthCount: thisMonthCustomers.length,
      upcomingCount: upcoming.length,
      vipThisMonthCount: thisMonthCustomers.filter((c) => c.tier === "VIP").length,
    },
  };
}

export const MONTH_OPTIONS = MONTH_LABELS.map((label, index) => ({
  value: String(index + 1),
  label,
}));
