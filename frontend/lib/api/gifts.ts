import { apiDelete, apiGet, apiPatch, apiPost, buildQueryString } from "@/lib/api/client";
import type { ApiEnvelope, ApiListEnvelope } from "@/lib/api/types";

export type GiftCategory =
  | "FOOD_AND_BEVERAGE"
  | "HOME_AND_LIVING"
  | "BEAUTY_AND_WELLNESS"
  | "ELECTRONICS"
  | "GIFT_VOUCHERS"
  | "KIDS_AND_TOYS";

export const GIFT_CATEGORY_LABELS: Record<GiftCategory, string> = {
  FOOD_AND_BEVERAGE: "Food & Beverage",
  HOME_AND_LIVING: "Home & Living",
  BEAUTY_AND_WELLNESS: "Beauty & Wellness",
  ELECTRONICS: "Electronics",
  GIFT_VOUCHERS: "Gift Vouchers",
  KIDS_AND_TOYS: "Kids & Toys",
};

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  IN_STOCK: "In Stock",
  LOW_STOCK: "Low Stock",
  OUT_OF_STOCK: "Out of Stock",
};

export type GiftOccasion = "BIRTHDAY" | "VIP_REWARD" | "LOYALTY_MILESTONE";

export const GIFT_OCCASION_LABELS: Record<GiftOccasion, string> = {
  BIRTHDAY: "Birthday",
  VIP_REWARD: "VIP Reward",
  LOYALTY_MILESTONE: "Loyalty Milestone",
};

export type GiftOrderStatus = "PENDING" | "SCHEDULED" | "SENT" | "CANCELLED";

export function formatCurrency(value: number): string {
  return `৳${value.toLocaleString("en-US")}`;
}

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

interface GiftItemDto {
  id: string;
  name: string;
  category: GiftCategory;
  description: string;
  pointsCost: number;
  retailValue: string | number;
  stockStatus: StockStatus;
  stockQuantity: number;
  timesRedeemed: number;
}

function mapDtoToGiftItem(dto: GiftItemDto): GiftItem {
  return {
    id: dto.id,
    name: dto.name,
    category: dto.category,
    description: dto.description,
    pointsCost: dto.pointsCost,
    retailValue: Number(dto.retailValue),
    stockStatus: dto.stockStatus,
    stockQuantity: dto.stockQuantity,
    timesRedeemed: dto.timesRedeemed,
  };
}

export interface ListGiftCatalogParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: GiftCategory | "all";
}

export interface PaginatedGiftCatalog {
  items: GiftItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listGiftCatalog(
  params: ListGiftCatalogParams = {}
): Promise<PaginatedGiftCatalog> {
  const query = buildQueryString({
    page: params.page ?? 1,
    page_size: params.pageSize ?? 50,
    search: params.search?.trim() || undefined,
    category: params.category && params.category !== "all" ? params.category : undefined,
  });

  const envelope = await apiGet<ApiListEnvelope<GiftItemDto>>(`/gifts/catalog${query}`);

  return {
    items: envelope.data.map(mapDtoToGiftItem),
    total: envelope.meta.total,
    page: envelope.meta.page,
    pageSize: envelope.meta.pageSize,
  };
}

export interface GiftCatalogItemInput {
  name: string;
  category: GiftCategory;
  description?: string;
  pointsCost: number;
  retailValue: number;
  stockQuantity: number;
}

export async function createGiftCatalogItem(input: GiftCatalogItemInput): Promise<GiftItem> {
  const envelope = await apiPost<ApiEnvelope<GiftItemDto>>("/gifts/catalog", {
    name: input.name,
    category: input.category,
    description: input.description ?? "",
    points_cost: input.pointsCost,
    retail_value: input.retailValue,
    stock_quantity: input.stockQuantity,
  });
  return mapDtoToGiftItem(envelope.data);
}

export async function updateGiftCatalogItem(
  id: string,
  input: Partial<GiftCatalogItemInput>
): Promise<GiftItem> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.category !== undefined) body.category = input.category;
  if (input.description !== undefined) body.description = input.description;
  if (input.pointsCost !== undefined) body.points_cost = input.pointsCost;
  if (input.retailValue !== undefined) body.retail_value = input.retailValue;
  if (input.stockQuantity !== undefined) body.stock_quantity = input.stockQuantity;

  const envelope = await apiPatch<ApiEnvelope<GiftItemDto>>(`/gifts/catalog/${id}`, body);
  return mapDtoToGiftItem(envelope.data);
}

export async function deleteGiftCatalogItem(id: string): Promise<void> {
  await apiDelete<void>(`/gifts/catalog/${id}`);
}

export interface GiftOrder {
  id: string;
  customerId: string;
  customerName: string;
  customerInitials: string;
  customerTier: "VIP" | "Regular";
  giftName: string;
  pointsCost: number;
  occasion: GiftOccasion;
  status: GiftOrderStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  notificationError: string | null;
  createdAt: string;
}

interface GiftOrderDto {
  id: string;
  customer: { id: string; name: string; isVip: boolean };
  giftName: string;
  pointsCost: number;
  occasion: GiftOccasion;
  status: GiftOrderStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  notificationError: string | null;
  createdAt: string;
}

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

function mapDtoToGiftOrder(dto: GiftOrderDto): GiftOrder {
  return {
    id: dto.id,
    customerId: dto.customer.id,
    customerName: dto.customer.name,
    customerInitials: getInitials(dto.customer.name),
    customerTier: dto.customer.isVip ? "VIP" : "Regular",
    giftName: dto.giftName,
    pointsCost: dto.pointsCost,
    occasion: dto.occasion,
    status: dto.status,
    scheduledFor: dto.scheduledFor,
    sentAt: dto.sentAt,
    notificationError: dto.notificationError,
    createdAt: dto.createdAt,
  };
}

export interface ListGiftOrdersParams {
  page?: number;
  pageSize?: number;
  status?: GiftOrderStatus | "all";
}

export interface PaginatedGiftOrders {
  items: GiftOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listGiftOrders(
  params: ListGiftOrdersParams = {}
): Promise<PaginatedGiftOrders> {
  const query = buildQueryString({
    page: params.page ?? 1,
    page_size: params.pageSize ?? 50,
    status: params.status && params.status !== "all" ? params.status : undefined,
  });

  const envelope = await apiGet<ApiListEnvelope<GiftOrderDto>>(`/gifts/orders${query}`);

  return {
    items: envelope.data.map(mapDtoToGiftOrder),
    total: envelope.meta.total,
    page: envelope.meta.page,
    pageSize: envelope.meta.pageSize,
  };
}

export interface CreateGiftOrderInput {
  customerId: string;
  catalogItemId: string;
  occasion: GiftOccasion;
}

/** Creates a new gift order (status PENDING) — the entry point for "sending
 * a gift" to a customer. Rejected with an `ApiError` if the catalog item is
 * out of stock. */
export async function createGiftOrder(input: CreateGiftOrderInput): Promise<GiftOrder> {
  const envelope = await apiPost<ApiEnvelope<GiftOrderDto>>("/gifts/orders", {
    customer_id: input.customerId,
    catalog_item_id: input.catalogItemId,
    occasion: input.occasion,
  });
  return mapDtoToGiftOrder(envelope.data);
}

export interface UpdateGiftOrderStatusInput {
  status: GiftOrderStatus;
  /** Required (ISO "YYYY-MM-DD") when `status` is "SCHEDULED". */
  scheduledFor?: string;
}

/** Advances (or cancels) a gift order. Moving to `SENT` triggers a real SMS
 * to the customer through the configured gateway — a notification failure
 * shows up as `notificationError` on the response but never blocks the
 * status transition itself. */
export async function updateGiftOrderStatus(
  id: string,
  input: UpdateGiftOrderStatusInput
): Promise<GiftOrder> {
  const envelope = await apiPatch<ApiEnvelope<GiftOrderDto>>(`/gifts/orders/${id}`, {
    status: input.status,
    scheduled_for: input.scheduledFor,
  });
  return mapDtoToGiftOrder(envelope.data);
}

export interface GiftStats {
  totalGiftsInCatalog: number;
  pendingOrdersCount: number;
  scheduledOrdersCount: number;
  sentOrdersCount: number;
}

export async function getGiftStats(): Promise<GiftStats> {
  const envelope = await apiGet<ApiEnvelope<GiftStats>>("/gifts/stats");
  return envelope.data;
}
