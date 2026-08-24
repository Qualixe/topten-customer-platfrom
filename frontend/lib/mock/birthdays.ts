export type CustomerTier = "VIP" | "Regular";
export type GiftStatus = "Pending" | "Scheduled" | "Sent";

interface RawBirthdayCustomer {
  name: string;
  tier: CustomerTier;
  birthYear: number;
  birthMonth: number; // 1-12
  birthDay: number;
  giftStatus: GiftStatus;
}

export interface BirthdayCustomer {
  id: string;
  name: string;
  initials: string;
  email: string;
  tier: CustomerTier;
  birthMonth: number;
  birthDay: number;
  turningAge: number;
  nextOccurrence: Date;
  dateLabel: string;
  daysAway: number;
  isToday: boolean;
  giftStatus: GiftStatus | "Not due yet";
}

/**
 * The dashboard's mock "today" is fixed rather than derived from the real
 * clock, so the Today / Upcoming buckets stay stable across every run.
 */
export const REFERENCE_DATE = new Date(2026, 7, 18);

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const RAW_CUSTOMERS: RawBirthdayCustomer[] = [
  // Today (Aug 18)
  { name: "Farhana Akter", tier: "VIP", birthYear: 1989, birthMonth: 8, birthDay: 18, giftStatus: "Pending" },
  { name: "Rakib Hossain", tier: "Regular", birthYear: 1995, birthMonth: 8, birthDay: 18, giftStatus: "Pending" },
  { name: "Ayesha Sultana", tier: "Regular", birthYear: 1992, birthMonth: 8, birthDay: 18, giftStatus: "Scheduled" },

  // Upcoming, within the next 30 days (Aug 19 - Sep 17)
  { name: "Tanvir Ahmed", tier: "VIP", birthYear: 1987, birthMonth: 8, birthDay: 19, giftStatus: "Scheduled" },
  { name: "Nadia Islam", tier: "Regular", birthYear: 1998, birthMonth: 8, birthDay: 21, giftStatus: "Pending" },
  { name: "Kamrul Haque", tier: "Regular", birthYear: 1990, birthMonth: 8, birthDay: 24, giftStatus: "Pending" },
  { name: "Israt Jahan", tier: "VIP", birthYear: 1985, birthMonth: 8, birthDay: 27, giftStatus: "Sent" },
  { name: "Shafin Karim", tier: "Regular", birthYear: 1999, birthMonth: 8, birthDay: 30, giftStatus: "Pending" },
  { name: "Promi Das", tier: "Regular", birthYear: 1993, birthMonth: 9, birthDay: 5, giftStatus: "Scheduled" },
  { name: "Zayan Chowdhury", tier: "VIP", birthYear: 1991, birthMonth: 9, birthDay: 12, giftStatus: "Pending" },

  // Rest of the year
  { name: "Amelia Chowdhury", tier: "VIP", birthYear: 1988, birthMonth: 1, birthDay: 12, giftStatus: "Sent" },
  { name: "Rafiq Islam", tier: "Regular", birthYear: 1994, birthMonth: 1, birthDay: 28, giftStatus: "Sent" },
  { name: "Nusrat Jahan", tier: "Regular", birthYear: 1996, birthMonth: 2, birthDay: 9, giftStatus: "Sent" },
  { name: "Samiul Karim", tier: "Regular", birthYear: 2000, birthMonth: 2, birthDay: 22, giftStatus: "Sent" },
  { name: "Priya Das", tier: "VIP", birthYear: 1986, birthMonth: 3, birthDay: 3, giftStatus: "Sent" },
  { name: "Mahin Rahman", tier: "Regular", birthYear: 1997, birthMonth: 3, birthDay: 17, giftStatus: "Sent" },
  { name: "Adiba Sultana", tier: "Regular", birthYear: 1991, birthMonth: 3, birthDay: 29, giftStatus: "Sent" },
  { name: "Fahim Uddin", tier: "Regular", birthYear: 1989, birthMonth: 4, birthDay: 6, giftStatus: "Sent" },
  { name: "Tasnim Begum", tier: "VIP", birthYear: 1990, birthMonth: 4, birthDay: 19, giftStatus: "Sent" },
  { name: "Sadia Alam", tier: "Regular", birthYear: 1995, birthMonth: 5, birthDay: 2, giftStatus: "Sent" },
  { name: "Imran Talukder", tier: "Regular", birthYear: 1993, birthMonth: 5, birthDay: 15, giftStatus: "Sent" },
  { name: "Labonno Bhuiyan", tier: "Regular", birthYear: 1998, birthMonth: 5, birthDay: 27, giftStatus: "Sent" },
  { name: "Mehreen Chakma", tier: "VIP", birthYear: 1984, birthMonth: 6, birthDay: 8, giftStatus: "Sent" },
  { name: "Arif Mollah", tier: "Regular", birthYear: 1992, birthMonth: 6, birthDay: 21, giftStatus: "Sent" },
  { name: "Ruma Sarkar", tier: "Regular", birthYear: 1999, birthMonth: 7, birthDay: 2, giftStatus: "Sent" },
  { name: "Rezwan Alam", tier: "Regular", birthYear: 1990, birthMonth: 7, birthDay: 15, giftStatus: "Sent" },
  { name: "Shanta Akter", tier: "Regular", birthYear: 1996, birthMonth: 7, birthDay: 26, giftStatus: "Sent" },
  { name: "Nayeem Hossain", tier: "VIP", birthYear: 1987, birthMonth: 10, birthDay: 4, giftStatus: "Pending" },
  { name: "Tania Sultana", tier: "Regular", birthYear: 1994, birthMonth: 10, birthDay: 19, giftStatus: "Pending" },
  { name: "Hasib Rahman", tier: "Regular", birthYear: 1991, birthMonth: 11, birthDay: 2, giftStatus: "Pending" },
  { name: "Ayesha Khan", tier: "Regular", birthYear: 1997, birthMonth: 11, birthDay: 23, giftStatus: "Pending" },
  { name: "Kamrul Sarkar", tier: "VIP", birthYear: 1985, birthMonth: 12, birthDay: 5, giftStatus: "Pending" },
  { name: "Nadia Haque", tier: "Regular", birthYear: 1993, birthMonth: 12, birthDay: 25, giftStatus: "Pending" },
  { name: "Fahim Chowdhury", tier: "Regular", birthYear: 1990, birthMonth: 12, birthDay: 31, giftStatus: "Pending" },
];

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function computeNextOccurrence(month: number, day: number, reference: Date) {
  const referenceMidnight = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate()
  );
  let candidate = new Date(referenceMidnight.getFullYear(), month - 1, day);

  if (candidate < referenceMidnight) {
    candidate = new Date(referenceMidnight.getFullYear() + 1, month - 1, day);
  }

  const daysAway = Math.round(
    (candidate.getTime() - referenceMidnight.getTime()) / (1000 * 60 * 60 * 24)
  );

  return { nextOccurrence: candidate, daysAway };
}

function enrich(raw: RawBirthdayCustomer, index: number): BirthdayCustomer {
  const { nextOccurrence, daysAway } = computeNextOccurrence(
    raw.birthMonth,
    raw.birthDay,
    REFERENCE_DATE
  );
  const isToday = daysAway === 0;
  const turningAge = nextOccurrence.getFullYear() - raw.birthYear;

  return {
    id: `bday-${index + 1}`,
    name: raw.name,
    initials: initialsFor(raw.name),
    email: `${raw.name.toLowerCase().replace(/\s+/g, ".")}${index}@example.com`,
    tier: raw.tier,
    birthMonth: raw.birthMonth,
    birthDay: raw.birthDay,
    turningAge,
    nextOccurrence,
    dateLabel: `${MONTH_LABELS[raw.birthMonth - 1]} ${raw.birthDay}`,
    daysAway,
    isToday,
    giftStatus: daysAway <= 30 ? raw.giftStatus : "Not due yet",
  };
}

export const mockBirthdayCustomers: BirthdayCustomer[] = RAW_CUSTOMERS.map(
  (raw, index) => enrich(raw, index)
).sort((a, b) => a.daysAway - b.daysAway);

export const todaysBirthdays = mockBirthdayCustomers.filter((c) => c.isToday);

export const upcomingBirthdays = mockBirthdayCustomers.filter(
  (c) => !c.isToday && c.daysAway <= 30
);

export const birthdaysThisMonth = mockBirthdayCustomers.filter(
  (c) => c.birthMonth === REFERENCE_DATE.getMonth() + 1
);

export const vipBirthdaysThisMonth = birthdaysThisMonth.filter(
  (c) => c.tier === "VIP"
);

export const MONTH_OPTIONS = MONTH_LABELS.map((label, index) => ({
  value: String(index + 1),
  label,
}));
