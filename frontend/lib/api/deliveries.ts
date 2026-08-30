import { apiGet, apiPatch, apiPost, buildQueryString } from "@/lib/api/client";
import type { ApiEnvelope, ApiListEnvelope, PaginationParams } from "@/lib/api/types";

export type CourierProvider =
  | "Pathao"
  | "RedX"
  | "Paperfly"
  | "Sundarban Courier"
  | "eCourier";

export const COURIER_PROVIDERS: CourierProvider[] = [
  "Pathao",
  "RedX",
  "Paperfly",
  "Sundarban Courier",
  "eCourier",
];

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
  estimatedDelivery: string | null;
  deliveredAt: string | null;
  notes: string | null;
}

export interface DeliveryStats {
  totalDeliveries: number;
  inTransitCount: number;
  deliveredCount: number;
  issuesCount: number;
}

/** Backend enum values (SCREAMING_SNAKE, see backend/app/models/delivery.py)
 * mapped to the display strings this UI already renders everywhere. */
const COURIER_FROM_BACKEND: Record<string, CourierProvider> = {
  PATHAO: "Pathao",
  REDX: "RedX",
  PAPERFLY: "Paperfly",
  SUNDARBAN_COURIER: "Sundarban Courier",
  ECOURIER: "eCourier",
};

export const COURIER_TO_BACKEND: Record<CourierProvider, string> = {
  Pathao: "PATHAO",
  RedX: "REDX",
  Paperfly: "PAPERFLY",
  "Sundarban Courier": "SUNDARBAN_COURIER",
  eCourier: "ECOURIER",
};

const STATUS_FROM_BACKEND: Record<string, DeliveryStatus> = {
  PENDING_PICKUP: "Pending Pickup",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  RETURNED: "Returned",
};

const STATUS_TO_BACKEND: Record<DeliveryStatus, string> = {
  "Pending Pickup": "PENDING_PICKUP",
  "In Transit": "IN_TRANSIT",
  "Out for Delivery": "OUT_FOR_DELIVERY",
  Delivered: "DELIVERED",
  Failed: "FAILED",
  Returned: "RETURNED",
};

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

interface DeliveryDto {
  id: string;
  giftOrder: {
    id: string;
    giftName: string;
    customer: { id: string; name: string; isVip: boolean };
  };
  courier: string;
  trackingNumber: string;
  status: string;
  address: string;
  city: string;
  dispatchedAt: string;
  estimatedDelivery: string | null;
  deliveredAt: string | null;
  notes: string | null;
}

function mapDtoToDelivery(dto: DeliveryDto): Delivery {
  return {
    id: dto.id,
    trackingNumber: dto.trackingNumber,
    customerName: dto.giftOrder.customer.name,
    customerInitials: getInitials(dto.giftOrder.customer.name),
    customerTier: dto.giftOrder.customer.isVip ? "VIP" : "Regular",
    giftName: dto.giftOrder.giftName,
    courier: COURIER_FROM_BACKEND[dto.courier] ?? "Pathao",
    status: STATUS_FROM_BACKEND[dto.status] ?? "Pending Pickup",
    address: dto.address,
    city: dto.city,
    dispatchedAt: new Date(dto.dispatchedAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    estimatedDelivery: dto.estimatedDelivery
      ? new Date(dto.estimatedDelivery).toLocaleDateString("en-US", { dateStyle: "medium" })
      : null,
    deliveredAt: dto.deliveredAt
      ? new Date(dto.deliveredAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
      : null,
    notes: dto.notes,
  };
}

export interface ListDeliveriesParams extends PaginationParams {
  courier?: CourierProvider | "all";
  status?: DeliveryStatus | "all";
  search?: string;
}

export interface PaginatedDeliveries {
  items: Delivery[];
  total: number;
  page: number;
  pageSize: number;
}

/** Fetches a page of courier deliveries. A generous default page size (like
 * `listGiftOrders`/`listCampaigns` elsewhere) since the deliveries directory
 * filters/searches client-side over whatever comes back. */
export async function listDeliveries(
  params: ListDeliveriesParams = {}
): Promise<PaginatedDeliveries> {
  const query = buildQueryString({
    page: params.page ?? 1,
    page_size: params.pageSize ?? 100,
    courier: params.courier && params.courier !== "all" ? COURIER_TO_BACKEND[params.courier] : undefined,
    status: params.status && params.status !== "all" ? STATUS_TO_BACKEND[params.status] : undefined,
    search: params.search?.trim() || undefined,
  });

  const envelope = await apiGet<ApiListEnvelope<DeliveryDto>>(`/couriers/deliveries${query}`);

  return {
    items: envelope.data.map(mapDtoToDelivery),
    total: envelope.meta.total,
    page: envelope.meta.page,
    pageSize: envelope.meta.pageSize,
  };
}

interface DeliveryStatsDto {
  total: number;
  inTransit: number;
  delivered: number;
  issues: number;
}

export async function getDeliveryStats(): Promise<DeliveryStats> {
  const envelope = await apiGet<ApiEnvelope<DeliveryStatsDto>>("/couriers/deliveries/stats");
  return {
    totalDeliveries: envelope.data.total,
    inTransitCount: envelope.data.inTransit,
    deliveredCount: envelope.data.delivered,
    issuesCount: envelope.data.issues,
  };
}

export interface EligibleGiftOrder {
  id: string;
  giftName: string;
  customerName: string;
}

interface EligibleGiftOrderDto {
  id: string;
  giftName: string;
  customer: { id: string; name: string; isVip: boolean };
}

/** Gift orders with no delivery yet — source list for "create delivery".
 * Nothing is created here. */
export async function listEligibleGiftOrdersForDelivery(
  search: string
): Promise<EligibleGiftOrder[]> {
  const query = buildQueryString({ search: search.trim() || undefined, page_size: 20 });
  const envelope = await apiGet<ApiListEnvelope<EligibleGiftOrderDto>>(
    `/couriers/deliveries/eligible-gift-orders${query}`
  );
  return envelope.data.map((order) => ({
    id: order.id,
    giftName: order.giftName,
    customerName: order.customer.name,
  }));
}

export interface CreateDeliveryInput {
  giftOrderId: string;
  courier: CourierProvider;
  trackingNumber: string;
  address: string;
  city: string;
  /** ISO date string (yyyy-mm-dd). */
  estimatedDelivery?: string;
}

export async function createDelivery(input: CreateDeliveryInput): Promise<Delivery> {
  const envelope = await apiPost<ApiEnvelope<DeliveryDto>>("/couriers/deliveries", {
    gift_order_id: input.giftOrderId,
    courier: COURIER_TO_BACKEND[input.courier],
    tracking_number: input.trackingNumber,
    address: input.address,
    city: input.city,
    estimated_delivery: input.estimatedDelivery || undefined,
  });
  return mapDtoToDelivery(envelope.data);
}

export async function updateDeliveryStatus(
  id: string,
  input: { status: DeliveryStatus; notes?: string }
): Promise<Delivery> {
  const envelope = await apiPatch<ApiEnvelope<DeliveryDto>>(`/couriers/deliveries/${id}`, {
    status: STATUS_TO_BACKEND[input.status],
    notes: input.notes,
  });
  return mapDtoToDelivery(envelope.data);
}
