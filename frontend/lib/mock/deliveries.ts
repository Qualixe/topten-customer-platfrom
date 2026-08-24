export type CourierProvider =
  | "Pathao"
  | "RedX"
  | "Paperfly"
  | "Sundarban Courier"
  | "eCourier";

export type DeliveryStatus =
  | "Pending Pickup"
  | "In Transit"
  | "Out for Delivery"
  | "Delivered"
  | "Failed"
  | "Returned";

export interface Delivery {
  id: string;
  trackingNumber: string;
  customerName: string;
  customerInitials: string;
  customerTier: "VIP" | "Regular";
  giftName: string;
  courier: CourierProvider;
  status: DeliveryStatus;
  address: string;
  city: string;
  dispatchedAt: string;
  estimatedDelivery: string;
  deliveredAt: string | null;
  notes: string | null;
}

const CUSTOMERS: { name: string; tier: "VIP" | "Regular" }[] = [
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

const GIFT_NAMES = [
  "Premium Tea Gift Box",
  "Artisan Chocolate Hamper",
  "Scented Candle Set",
  "Cotton Bedsheet Set",
  "Skincare Essentials Kit",
  "Spa Relaxation Set",
  "Bluetooth Speaker",
  "৳1000 Shopping Voucher",
  "Building Blocks Set",
  "Plush Toy Bundle",
];

const COURIERS: CourierProvider[] = [
  "Pathao",
  "RedX",
  "Paperfly",
  "Sundarban Courier",
  "eCourier",
];

const CITIES = [
  "Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna", "Barishal",
  "Rangpur", "Mymensingh",
];

const STREET_NAMES = [
  "Gulshan Avenue", "Dhanmondi Road 8", "Banani Lake Road", "Mirpur Road",
  "Agrabad Access Road", "Zindabazar Point", "Shaheb Bazar", "Boalia Lane",
];

const STATUS_CYCLE: DeliveryStatus[] = [
  "Delivered", "In Transit", "Out for Delivery", "Pending Pickup",
  "Delivered", "In Transit", "Failed", "Delivered", "Returned",
  "Out for Delivery",
];

const DISPATCHED_LABELS = [
  "Today, 9:10 AM", "Yesterday", "2 days ago", "3 days ago", "5 days ago",
  "1 week ago", "2 weeks ago",
];

const ESTIMATED_LABELS = [
  "Aug 19, 2026", "Aug 20, 2026", "Aug 21, 2026", "Aug 22, 2026", "Aug 24, 2026",
];

const DELIVERED_LABELS = [
  "Aug 16, 2026", "Aug 15, 2026", "Aug 14, 2026", "Aug 12, 2026", "Aug 10, 2026",
];

const NOTES_BY_STATUS: Partial<Record<DeliveryStatus, string>> = {
  Failed: "Recipient unreachable after two delivery attempts.",
  Returned: "Package returned to warehouse — incorrect address.",
};

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function trackingNumberFor(courier: CourierProvider, index: number) {
  const prefix = courier
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return `${prefix}-${(2026000 + index * 137).toString()}`;
}

function buildDeliveries(count: number): Delivery[] {
  return Array.from({ length: count }, (_, i) => {
    const customer = CUSTOMERS[i % CUSTOMERS.length];
    const courier = COURIERS[i % COURIERS.length];
    const status = STATUS_CYCLE[i % STATUS_CYCLE.length];
    const city = CITIES[(i * 3 + 1) % CITIES.length];
    const street = STREET_NAMES[i % STREET_NAMES.length];
    const isDelivered = status === "Delivered";

    return {
      id: `delivery-${i + 1}`,
      trackingNumber: trackingNumberFor(courier, i),
      customerName: customer.name,
      customerInitials: initialsFor(customer.name),
      customerTier: customer.tier,
      giftName: GIFT_NAMES[(i * 2 + 1) % GIFT_NAMES.length],
      courier,
      status,
      address: `House ${((i * 7) % 40) + 1}, ${street}`,
      city,
      dispatchedAt: DISPATCHED_LABELS[i % DISPATCHED_LABELS.length],
      estimatedDelivery: ESTIMATED_LABELS[i % ESTIMATED_LABELS.length],
      deliveredAt: isDelivered ? DELIVERED_LABELS[i % DELIVERED_LABELS.length] : null,
      notes: NOTES_BY_STATUS[status] ?? null,
    };
  });
}

export const mockDeliveries: Delivery[] = buildDeliveries(32);

export const totalDeliveries = mockDeliveries.length;

export const inTransitCount = mockDeliveries.filter(
  (delivery) =>
    delivery.status === "In Transit" || delivery.status === "Out for Delivery"
).length;

export const deliveredCount = mockDeliveries.filter(
  (delivery) => delivery.status === "Delivered"
).length;

export const issuesCount = mockDeliveries.filter(
  (delivery) => delivery.status === "Failed" || delivery.status === "Returned"
).length;
