import { paginate, simulateNetworkDelay } from "@/lib/api/client";
import type { PaginatedResponse, PaginationParams } from "@/lib/api/types";
import {
  mockGiftCatalog,
  mockGiftOrders,
  pendingOrdersCount,
  scheduledOrdersCount,
  sentOrdersCount,
  totalGiftsInCatalog,
  type GiftItem,
  type GiftOrder,
  type GiftOrderStatus,
} from "@/lib/mock/gifts";

export type {
  GiftCategory,
  GiftItem,
  GiftOccasion,
  GiftOrder,
  GiftOrderStatus,
  StockStatus,
} from "@/lib/mock/gifts";
export { formatCurrency } from "@/lib/mock/gifts";

export interface GiftStats {
  totalGiftsInCatalog: number;
  pendingOrdersCount: number;
  scheduledOrdersCount: number;
  sentOrdersCount: number;
}

export interface ListGiftOrdersParams extends PaginationParams {
  status?: GiftOrderStatus;
}

/**
 * Fetches a page of the gift catalog.
 *
 * Backed by in-memory mock data for now — swap for `apiFetch` once
 * `/gifts/catalog` exists on the backend.
 */
export async function listGiftCatalog(
  params: PaginationParams = {}
): Promise<PaginatedResponse<GiftItem>> {
  await simulateNetworkDelay();
  return paginate(mockGiftCatalog, params);
}

/**
 * Fetches a page of gift orders, optionally filtered by status.
 *
 * Backed by in-memory mock data for now — swap for `apiFetch` once
 * `/gifts/orders` exists on the backend.
 */
export async function listGiftOrders(
  params: ListGiftOrdersParams = {}
): Promise<PaginatedResponse<GiftOrder>> {
  await simulateNetworkDelay();
  const { status, ...pagination } = params;
  const orders = status
    ? mockGiftOrders.filter((order) => order.status === status)
    : mockGiftOrders;
  return paginate(orders, pagination);
}

export async function getGiftStats(): Promise<GiftStats> {
  await simulateNetworkDelay();
  return {
    totalGiftsInCatalog,
    pendingOrdersCount,
    scheduledOrdersCount,
    sentOrdersCount,
  };
}
