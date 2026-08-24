export type VipLevel = "Platinum" | "Gold" | "Silver";
export type VipStatus = "Active" | "At Risk" | "Inactive";

export interface VipCustomer {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  city: string;
  vipLevel: VipLevel;
  status: VipStatus;
  totalSpent: number;
  totalOrders: number;
  avgOrderValue: number;
  lastPurchaseAt: string;
  memberSince: string;
  favoriteCategory: string;
}

const FIRST_NAMES = [
  "Amelia", "Rafiq", "Nusrat", "Tanvir", "Farhana", "Priya", "Mahin", "Israt",
  "Zayan", "Mehreen", "Kamrul", "Shanta", "Rezwan", "Ayesha", "Nayeem",
  "Tasnim", "Fahim", "Adiba", "Labonno", "Arif", "Promi", "Hasib", "Tania",
  "Sadia",
];

const LAST_NAMES = [
  "Chowdhury", "Islam", "Jahan", "Ahmed", "Akter", "Das", "Rahman", "Hossain",
  "Khan", "Alam", "Sultana", "Uddin", "Begum", "Haque", "Talukder", "Bhuiyan",
  "Mollah", "Sarkar", "Chakma", "Karim",
];

const CITIES = [
  "Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna", "Barishal",
  "Rangpur", "Mymensingh",
];

const CATEGORIES = [
  "Groceries", "Fresh Produce", "Electronics", "Home & Living", "Beauty",
  "Bakery", "Beverages",
];

const MEMBER_SINCE_DATES = [
  "Jan 2021", "Jun 2021", "Nov 2021",
  "Mar 2022", "Aug 2022", "Dec 2022",
  "Apr 2023", "Sep 2023",
  "Feb 2024", "Jul 2024",
  "Jan 2025", "May 2025",
];

const LAST_PURCHASE_LABELS = [
  "Yesterday", "2 days ago", "5 days ago", "1 week ago", "2 weeks ago",
  "3 weeks ago", "1 month ago", "2 months ago",
];

const LEVEL_CYCLE: VipLevel[] = ["Platinum", "Gold", "Gold", "Silver", "Silver"];
const STATUS_CYCLE: VipStatus[] = ["Active", "Active", "Active", "At Risk", "Active", "Inactive"];

const SPEND_BY_LEVEL: Record<VipLevel, number> = {
  Platinum: 180000,
  Gold: 95000,
  Silver: 45000,
};

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function buildVipCustomers(count: number): VipCustomer[] {
  return Array.from({ length: count }, (_, i) => {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 7 + 5) % LAST_NAMES.length];
    const name = `${first} ${last}`;
    const vipLevel = LEVEL_CYCLE[i % LEVEL_CYCLE.length];
    const status = STATUS_CYCLE[i % STATUS_CYCLE.length];
    const totalOrders = 18 + ((i * 5) % 60);
    const baseSpend = SPEND_BY_LEVEL[vipLevel];
    const totalSpent = baseSpend + ((i * 733) % 20000);
    const avgOrderValue = Math.round(totalSpent / totalOrders);

    return {
      id: `vip-${i + 1}`,
      name,
      initials: initialsFor(name),
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      phone: `+8801${(710000000 + i * 8123).toString().slice(0, 9)}`,
      city: CITIES[(i * 3 + 2) % CITIES.length],
      vipLevel,
      status,
      totalSpent,
      totalOrders,
      avgOrderValue,
      lastPurchaseAt: LAST_PURCHASE_LABELS[i % LAST_PURCHASE_LABELS.length],
      memberSince: MEMBER_SINCE_DATES[i % MEMBER_SINCE_DATES.length],
      favoriteCategory: CATEGORIES[(i * 2 + 1) % CATEGORIES.length],
    };
  }).sort((a, b) => b.totalSpent - a.totalSpent);
}

export const mockVipCustomers: VipCustomer[] = buildVipCustomers(24);

export function formatCurrency(value: number) {
  return `৳${value.toLocaleString("en-US")}`;
}

export const totalVipCustomers = mockVipCustomers.length;

export const totalVipRevenue = mockVipCustomers.reduce(
  (sum, customer) => sum + customer.totalSpent,
  0
);

export const averageVipSpend = Math.round(
  totalVipRevenue / Math.max(1, totalVipCustomers)
);

export const atRiskVipCount = mockVipCustomers.filter(
  (customer) => customer.status === "At Risk"
).length;
