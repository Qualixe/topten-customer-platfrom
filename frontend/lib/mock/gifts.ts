export type GiftCategory =
  | "Food & Beverage"
  | "Home & Living"
  | "Beauty & Wellness"
  | "Electronics"
  | "Gift Vouchers"
  | "Kids & Toys";

export type StockStatus = "In Stock" | "Low Stock" | "Out of Stock";

export interface GiftItem {
  id: string;
  name: string;
  category: GiftCategory;
  description: string;
  pointsCost: number;
  retailValue: number;
  stockStatus: StockStatus;
  stockQuantity: number;
  timesRedeemed: number;
}

export type GiftOccasion = "Birthday" | "VIP Reward" | "Loyalty Milestone";
export type GiftOrderStatus = "Pending" | "Scheduled" | "Sent" | "Cancelled";

export interface GiftOrder {
  id: string;
  customerName: string;
  customerInitials: string;
  customerTier: "VIP" | "Regular";
  giftName: string;
  occasion: GiftOccasion;
  status: GiftOrderStatus;
  requestedAt: string;
  scheduledFor: string | null;
}

export function formatCurrency(value: number) {
  return `৳${value.toLocaleString("en-US")}`;
}

const CATALOG_RAW: Omit<GiftItem, "id">[] = [
  {
    name: "Premium Tea Gift Box",
    category: "Food & Beverage",
    description: "An assortment of premium loose-leaf teas in a keepsake box.",
    pointsCost: 800,
    retailValue: 1200,
    stockStatus: "In Stock",
    stockQuantity: 42,
    timesRedeemed: 118,
  },
  {
    name: "Artisan Chocolate Hamper",
    category: "Food & Beverage",
    description: "Handcrafted chocolates from local artisan makers.",
    pointsCost: 950,
    retailValue: 1450,
    stockStatus: "In Stock",
    stockQuantity: 30,
    timesRedeemed: 96,
  },
  {
    name: "Scented Candle Set",
    category: "Home & Living",
    description: "A set of three hand-poured scented candles.",
    pointsCost: 700,
    retailValue: 1100,
    stockStatus: "Low Stock",
    stockQuantity: 6,
    timesRedeemed: 74,
  },
  {
    name: "Cotton Bedsheet Set",
    category: "Home & Living",
    description: "Soft cotton bedsheet set with two pillow covers.",
    pointsCost: 1800,
    retailValue: 3200,
    stockStatus: "In Stock",
    stockQuantity: 18,
    timesRedeemed: 41,
  },
  {
    name: "Ceramic Dinnerware Set",
    category: "Home & Living",
    description: "A 12-piece ceramic dinnerware set for four.",
    pointsCost: 2400,
    retailValue: 4500,
    stockStatus: "Low Stock",
    stockQuantity: 4,
    timesRedeemed: 22,
  },
  {
    name: "Skincare Essentials Kit",
    category: "Beauty & Wellness",
    description: "Cleanser, toner, and moisturizer travel-size kit.",
    pointsCost: 1100,
    retailValue: 1900,
    stockStatus: "In Stock",
    stockQuantity: 25,
    timesRedeemed: 87,
  },
  {
    name: "Spa Relaxation Set",
    category: "Beauty & Wellness",
    description: "Bath salts, body oil, and a soft towel wrap.",
    pointsCost: 1350,
    retailValue: 2100,
    stockStatus: "In Stock",
    stockQuantity: 20,
    timesRedeemed: 53,
  },
  {
    name: "Electric Kettle",
    category: "Electronics",
    description: "1.7L stainless steel electric kettle with auto shut-off.",
    pointsCost: 2200,
    retailValue: 3800,
    stockStatus: "Out of Stock",
    stockQuantity: 0,
    timesRedeemed: 34,
  },
  {
    name: "Bluetooth Speaker",
    category: "Electronics",
    description: "Compact portable speaker with 10-hour battery life.",
    pointsCost: 2600,
    retailValue: 4200,
    stockStatus: "In Stock",
    stockQuantity: 15,
    timesRedeemed: 29,
  },
  {
    name: "Wireless Earbuds",
    category: "Electronics",
    description: "Entry-level wireless earbuds with charging case.",
    pointsCost: 3000,
    retailValue: 5000,
    stockStatus: "Low Stock",
    stockQuantity: 5,
    timesRedeemed: 18,
  },
  {
    name: "৳500 Shopping Voucher",
    category: "Gift Vouchers",
    description: "Redeemable in-store voucher worth ৳500.",
    pointsCost: 500,
    retailValue: 500,
    stockStatus: "In Stock",
    stockQuantity: 999,
    timesRedeemed: 214,
  },
  {
    name: "৳1000 Shopping Voucher",
    category: "Gift Vouchers",
    description: "Redeemable in-store voucher worth ৳1,000.",
    pointsCost: 950,
    retailValue: 1000,
    stockStatus: "In Stock",
    stockQuantity: 999,
    timesRedeemed: 176,
  },
  {
    name: "৳2000 Shopping Voucher",
    category: "Gift Vouchers",
    description: "Redeemable in-store voucher worth ৳2,000.",
    pointsCost: 1850,
    retailValue: 2000,
    stockStatus: "In Stock",
    stockQuantity: 999,
    timesRedeemed: 92,
  },
  {
    name: "Building Blocks Set",
    category: "Kids & Toys",
    description: "150-piece colorful building block set for kids.",
    pointsCost: 900,
    retailValue: 1500,
    stockStatus: "In Stock",
    stockQuantity: 22,
    timesRedeemed: 40,
  },
  {
    name: "Plush Toy Bundle",
    category: "Kids & Toys",
    description: "A bundle of three soft plush toys.",
    pointsCost: 650,
    retailValue: 1000,
    stockStatus: "In Stock",
    stockQuantity: 28,
    timesRedeemed: 61,
  },
  {
    name: "Kids Art Supply Kit",
    category: "Kids & Toys",
    description: "Crayons, markers, and a sketchbook for young artists.",
    pointsCost: 550,
    retailValue: 850,
    stockStatus: "Out of Stock",
    stockQuantity: 0,
    timesRedeemed: 35,
  },
];

export const mockGiftCatalog: GiftItem[] = CATALOG_RAW.map((item, index) => ({
  id: `gift-${index + 1}`,
  ...item,
}));

const ORDER_CUSTOMERS: { name: string; tier: "VIP" | "Regular" }[] = [
  { name: "Farhana Akter", tier: "VIP" },
  { name: "Rakib Hossain", tier: "Regular" },
  { name: "Ayesha Sultana", tier: "Regular" },
  { name: "Tanvir Ahmed", tier: "VIP" },
  { name: "Nadia Islam", tier: "Regular" },
  { name: "Kamrul Haque", tier: "Regular" },
  { name: "Israt Jahan", tier: "VIP" },
  { name: "Shafin Karim", tier: "Regular" },
  { name: "Promi Das", tier: "Regular" },
  { name: "Zayan Chowdhury", tier: "VIP" },
  { name: "Amelia Chowdhury", tier: "VIP" },
  { name: "Rafiq Islam", tier: "Regular" },
  { name: "Nusrat Jahan", tier: "Regular" },
  { name: "Samiul Karim", tier: "Regular" },
  { name: "Priya Das", tier: "VIP" },
];

const OCCASIONS: GiftOccasion[] = ["Birthday", "VIP Reward", "Loyalty Milestone"];
const ORDER_STATUS_CYCLE: GiftOrderStatus[] = [
  "Pending", "Pending", "Scheduled", "Sent", "Sent", "Cancelled", "Pending",
];
const REQUESTED_LABELS = [
  "Just now", "2 hours ago", "Yesterday", "2 days ago", "4 days ago",
  "1 week ago", "2 weeks ago", "3 weeks ago",
];
const SCHEDULED_LABELS = ["Aug 20, 2026", "Aug 22, 2026", "Aug 25, 2026", "Sep 1, 2026"];

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function buildGiftOrders(count: number): GiftOrder[] {
  return Array.from({ length: count }, (_, i) => {
    const customer = ORDER_CUSTOMERS[i % ORDER_CUSTOMERS.length];
    const gift = mockGiftCatalog[(i * 3 + 1) % mockGiftCatalog.length];
    const status = ORDER_STATUS_CYCLE[i % ORDER_STATUS_CYCLE.length];
    const occasion = OCCASIONS[(i * 2) % OCCASIONS.length];

    return {
      id: `order-${i + 1}`,
      customerName: customer.name,
      customerInitials: initialsFor(customer.name),
      customerTier: customer.tier,
      giftName: gift.name,
      occasion,
      status,
      requestedAt: REQUESTED_LABELS[i % REQUESTED_LABELS.length],
      scheduledFor:
        status === "Scheduled" || status === "Sent"
          ? SCHEDULED_LABELS[i % SCHEDULED_LABELS.length]
          : null,
    };
  });
}

export const mockGiftOrders: GiftOrder[] = buildGiftOrders(28);

export const pendingGiftOrders = mockGiftOrders.filter(
  (order) => order.status === "Pending"
);

export const totalGiftsInCatalog = mockGiftCatalog.length;
export const pendingOrdersCount = pendingGiftOrders.length;
export const scheduledOrdersCount = mockGiftOrders.filter(
  (order) => order.status === "Scheduled"
).length;
export const sentOrdersCount = mockGiftOrders.filter(
  (order) => order.status === "Sent"
).length;
