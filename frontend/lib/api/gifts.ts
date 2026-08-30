import {
  API_BASE_URL,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  buildQueryString,
  getAuthorizationHeader,
} from "@/lib/api/client";
import type { ApiEnvelope, ApiListEnvelope } from "@/lib/api/types";
import { ApiError, NetworkError } from "@/lib/api/types";
import { COURIER_TO_BACKEND, type CourierProvider } from "@/lib/api/deliveries";

/** Categories are admin-managed rows (see `listGiftCategories` etc. below),
 * not a fixed list — this is just the id/name shape a gift references. */
export interface GiftCategoryOption {
  id: string;
  name: string;
}

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
  category: GiftCategoryOption;
  description: string;
  /** API-relative, e.g. "/gift-images/abc.png" — resolve with
   * `resolveGiftImageUrl` before rendering. Null if no photo was uploaded. */
  imageUrl: string | null;
  retailValue: number;
  stockStatus: StockStatus;
  stockQuantity: number;
  timesRedeemed: number;
}

interface GiftItemDto {
  id: string;
  name: string;
  category: GiftCategoryOption;
  description: string;
  imageUrl: string | null;
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
    imageUrl: dto.imageUrl,
    retailValue: Number(dto.retailValue),
    stockStatus: dto.stockStatus,
    stockQuantity: dto.stockQuantity,
    timesRedeemed: dto.timesRedeemed,
  };
}

/** Fetches the admin-managed category list, sorted by name. */
export async function listGiftCategories(): Promise<GiftCategoryOption[]> {
  const envelope = await apiGet<ApiListEnvelope<GiftCategoryOption>>("/gifts/categories");
  return envelope.data;
}

/** Throws `ApiError` (422) if the name is already taken. */
export async function createGiftCategory(name: string): Promise<GiftCategoryOption> {
  const envelope = await apiPost<ApiEnvelope<GiftCategoryOption>>("/gifts/categories", { name });
  return envelope.data;
}

/** Throws `ApiError` (422) if the new name is already taken. */
export async function updateGiftCategory(id: string, name: string): Promise<GiftCategoryOption> {
  const envelope = await apiPatch<ApiEnvelope<GiftCategoryOption>>(`/gifts/categories/${id}`, {
    name,
  });
  return envelope.data;
}

/** Throws `ApiError` (422) if any gift still uses this category. */
export async function deleteGiftCategory(id: string): Promise<void> {
  await apiDelete<void>(`/gifts/categories/${id}`);
}

/** Absolute URL for a gift photo path returned by the API (which is
 * API-relative, e.g. "/gift-images/abc.png") so `<img src>` resolves
 * against the backend, not the frontend's own origin. */
export function resolveGiftImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  const apiOrigin = new URL(API_BASE_URL).origin;
  return `${apiOrigin}${imageUrl}`;
}

export interface ListGiftCatalogParams {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string | "all";
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
    category_id: params.categoryId && params.categoryId !== "all" ? params.categoryId : undefined,
  });

  const envelope = await apiGet<ApiListEnvelope<GiftItemDto>>(`/gifts/catalog${query}`);

  return {
    items: envelope.data.map(mapDtoToGiftItem),
    total: envelope.meta.total,
    page: envelope.meta.page,
    pageSize: envelope.meta.pageSize,
  };
}

/** Fetches a single catalog item by id. Throws `ApiError` (404) if it
 * doesn't exist. */
export async function getGiftCatalogItem(id: string): Promise<GiftItem> {
  const envelope = await apiGet<ApiEnvelope<GiftItemDto>>(`/gifts/catalog/${id}`);
  return mapDtoToGiftItem(envelope.data);
}

export interface GiftCatalogItemInput {
  name: string;
  categoryId: string;
  description?: string;
  retailValue: number;
  stockQuantity: number;
}

export async function createGiftCatalogItem(input: GiftCatalogItemInput): Promise<GiftItem> {
  const envelope = await apiPost<ApiEnvelope<GiftItemDto>>("/gifts/catalog", {
    name: input.name,
    category_id: input.categoryId,
    description: input.description ?? "",
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
  if (input.categoryId !== undefined) body.category_id = input.categoryId;
  if (input.description !== undefined) body.description = input.description;
  if (input.retailValue !== undefined) body.retail_value = input.retailValue;
  if (input.stockQuantity !== undefined) body.stock_quantity = input.stockQuantity;

  const envelope = await apiPatch<ApiEnvelope<GiftItemDto>>(`/gifts/catalog/${id}`, body);
  return mapDtoToGiftItem(envelope.data);
}

export async function deleteGiftCatalogItem(id: string): Promise<void> {
  await apiDelete<void>(`/gifts/catalog/${id}`);
}

/** Uploads (or replaces) a gift's photo — multipart, not JSON. Throws
 * `ApiError` (e.g. wrong type, over 2 MB) or `NetworkError` on failure. */
export async function uploadGiftImage(id: string, file: File): Promise<GiftItem> {
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;
  try {
    const authHeader = await getAuthorizationHeader();
    response = await fetch(`${API_BASE_URL}/gifts/catalog/${id}/image`, {
      method: "PUT",
      headers: authHeader,
      body: formData,
    });
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : undefined);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let message = body || response.statusText;
    try {
      const parsed = JSON.parse(body) as { detail?: string };
      message = parsed.detail ?? message;
    } catch {
      // Not JSON — fall back to the raw text/status above.
    }
    throw new ApiError(message, response.status);
  }

  const envelope = (await response.json()) as ApiEnvelope<GiftItemDto>;
  return mapDtoToGiftItem(envelope.data);
}

export async function removeGiftImage(id: string): Promise<GiftItem> {
  const envelope = await apiDelete<ApiEnvelope<GiftItemDto>>(`/gifts/catalog/${id}/image`);
  return mapDtoToGiftItem(envelope.data);
}

export interface GiftOrder {
  id: string;
  customerId: string;
  customerName: string;
  customerInitials: string;
  customerTier: "VIP" | "Regular";
  giftName: string;
  occasion: GiftOccasion;
  status: GiftOrderStatus;
  deliveryAddress: string | null;
  wishText: string | null;
  scheduledFor: string | null;
  sentAt: string | null;
  notificationError: string | null;
  createdAt: string;
}

interface GiftOrderDto {
  id: string;
  customer: { id: string; name: string; isVip: boolean };
  giftName: string;
  occasion: GiftOccasion;
  status: GiftOrderStatus;
  deliveryAddress: string | null;
  wishText: string | null;
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
    occasion: dto.occasion,
    status: dto.status,
    deliveryAddress: dto.deliveryAddress,
    wishText: dto.wishText,
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
  catalogItemId?: string;
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
    catalog_item_id: params.catalogItemId,
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
  deliveryAddress?: string;
  wishText?: string;
}

/** Creates a new gift order (status PENDING) — the entry point for "sending
 * a gift" to a customer. Rejected with an `ApiError` if the catalog item is
 * out of stock. */
export async function createGiftOrder(input: CreateGiftOrderInput): Promise<GiftOrder> {
  const envelope = await apiPost<ApiEnvelope<GiftOrderDto>>("/gifts/orders", {
    customer_id: input.customerId,
    catalog_item_id: input.catalogItemId,
    occasion: input.occasion,
    delivery_address: input.deliveryAddress || undefined,
    wish_text: input.wishText || undefined,
  });
  return mapDtoToGiftOrder(envelope.data);
}

export interface BulkGiftRecipientInput {
  customerId: string;
  deliveryAddress?: string;
  wishText?: string;
  /** Set all three (plus deliveryAddress) to also create a courier
   * Delivery for this recipient in the same request — no separate trip to
   * the Couriers page. */
  courier?: CourierProvider;
  trackingNumber?: string;
  city?: string;
  /** ISO "YYYY-MM-DD". */
  estimatedDelivery?: string;
}

export interface CreateGiftOrdersBulkInput {
  recipients: BulkGiftRecipientInput[];
  catalogItemId: string;
  occasion: GiftOccasion;
}

/** Same gift, same occasion, queued for several customers in one request —
 * the entry point for "sending" a gift to a batch of customers at once.
 * All-or-nothing: rejected with an `ApiError` if any customer_id is
 * unknown or the catalog item is out of stock, before any order is
 * created. */
export async function createGiftOrdersBulk(input: CreateGiftOrdersBulkInput): Promise<GiftOrder[]> {
  const envelope = await apiPost<ApiEnvelope<GiftOrderDto[]>>("/gifts/orders/bulk", {
    recipients: input.recipients.map((recipient) => ({
      customer_id: recipient.customerId,
      delivery_address: recipient.deliveryAddress || undefined,
      wish_text: recipient.wishText || undefined,
      courier: recipient.courier ? COURIER_TO_BACKEND[recipient.courier] : undefined,
      tracking_number: recipient.trackingNumber || undefined,
      city: recipient.city || undefined,
      estimated_delivery: recipient.estimatedDelivery || undefined,
    })),
    catalog_item_id: input.catalogItemId,
    occasion: input.occasion,
  });
  return envelope.data.map(mapDtoToGiftOrder);
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
