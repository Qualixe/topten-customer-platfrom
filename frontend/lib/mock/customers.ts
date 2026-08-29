export type CustomerTier = "VIP" | "Regular";
export type CustomerStatus = "Active" | "Inactive" | "Suspended";
/** The POS-driven customer category, separate from `tier` (which is derived
 * from `is_vip`). Set via CSV import; see backend `CustomerType`. */
export type CustomerType = "GENERAL" | "VIP" | "VVIP";

export interface Customer {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  city: string;
  tier: CustomerTier;
  status: CustomerStatus;
  totalOrders: number;
  totalSpent: number;
  joinedAt: string;
  lastPurchaseAt: string;
  notes: string;
  /** Raw "YYYY-MM-DD", present on real API-backed customers so an edit form
   * can pre-fill it; absent (undefined) on mock-generated customers. */
  dateOfBirth?: string | null;
  /** Absent (undefined) on mock-generated customers, same as dateOfBirth. */
  customerType?: CustomerType;
  /** Raw saved address (or null), same availability caveat as dateOfBirth —
   * `city` above is a display-friendly "—"-on-null fallback derived from
   * this same backend field, not a separate value. */
  address?: string | null;
}

const FIRST_NAMES = [
  "Amelia", "Rafiq", "Nusrat", "Tanvir", "Farhana", "Samiul", "Priya", "Mahin",
  "Israt", "Adiba", "Fahim", "Nadia", "Shafin", "Tasnim", "Rakib", "Sadia",
  "Imran", "Labonno", "Zayan", "Mehreen", "Arif", "Ruma", "Kamrul", "Shanta",
  "Rezwan", "Ayesha", "Nayeem", "Promi", "Hasib", "Tania",
];

const LAST_NAMES = [
  "Chowdhury", "Islam", "Jahan", "Ahmed", "Akter", "Karim", "Das", "Rahman",
  "Hossain", "Khan", "Alam", "Sultana", "Uddin", "Begum", "Haque", "Talukder",
  "Bhuiyan", "Mollah", "Sarkar", "Chakma",
];

const CITIES = [
  "Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna", "Barishal",
  "Rangpur", "Mymensingh",
];

const JOIN_DATES = [
  "Jan 2022", "Apr 2022", "Jul 2022", "Oct 2022",
  "Jan 2023", "Mar 2023", "Jun 2023", "Sep 2023", "Dec 2023",
  "Feb 2024", "May 2024", "Aug 2024", "Nov 2024",
  "Jan 2025", "Apr 2025", "Jul 2025", "Oct 2025",
  "Feb 2026", "May 2026", "Aug 2026",
];

const LAST_PURCHASE_LABELS = [
  "2 days ago", "5 days ago", "1 week ago", "2 weeks ago", "3 weeks ago",
  "1 month ago", "2 months ago", "3 months ago", "6 months ago",
];

const TIER_CYCLE: CustomerTier[] = ["Regular", "Regular", "Regular", "VIP"];
const STATUS_CYCLE: CustomerStatus[] = [
  "Active", "Active", "Active", "Inactive", "Active", "Suspended", "Active",
];

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function buildCustomers(count: number): Customer[] {
  return Array.from({ length: count }, (_, i) => {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 7 + 3) % LAST_NAMES.length];
    const name = `${first} ${last}`;
    const tier = TIER_CYCLE[i % TIER_CYCLE.length];
    const status = STATUS_CYCLE[i % STATUS_CYCLE.length];
    const totalOrders = 2 + ((i * 5) % 58);
    const baseSpend = totalOrders * (tier === "VIP" ? 2600 : 950);
    const totalSpent = baseSpend + ((i * 137) % 900);

    return {
      id: `cust-${i + 1}`,
      name,
      initials: initialsFor(name),
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      phone: `+8801${(700000000 + i * 9137).toString().slice(0, 9)}`,
      city: CITIES[(i * 3 + 1) % CITIES.length],
      tier,
      status,
      totalOrders,
      totalSpent,
      joinedAt: JOIN_DATES[i % JOIN_DATES.length],
      lastPurchaseAt: LAST_PURCHASE_LABELS[i % LAST_PURCHASE_LABELS.length],
      notes:
        tier === "VIP"
          ? "Prefers home delivery and advance notice for restocks."
          : "No special preferences on file.",
    };
  });
}

export const mockCustomers: Customer[] = buildCustomers(56);

export function formatCurrency(value: number) {
  return `৳${value.toLocaleString("en-US")}`;
}
