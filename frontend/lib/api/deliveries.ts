import { paginate, simulateNetworkDelay } from "@/lib/api/client";
import type { PaginatedResponse, PaginationParams } from "@/lib/api/types";
import {
  deliveredCount,
  inTransitCount,
  issuesCount,
  mockDeliveries,
  totalDeliveries,
  type Delivery,
} from "@/lib/mock/deliveries";

export type {
  CourierProvider,
  Delivery,
  DeliveryStatus,
} from "@/lib/mock/deliveries";

export interface DeliveryStats {
  totalDeliveries: number;
  inTransitCount: number;
  deliveredCount: number;
  issuesCount: number;
}

/**
 * Fetches a page of courier deliveries.
 *
 * Backed by in-memory mock data for now — swap for `apiFetch` once
 * `/deliveries` exists on the backend.
 */
export async function listDeliveries(
  params: PaginationParams = {}
): Promise<PaginatedResponse<Delivery>> {
  await simulateNetworkDelay();
  return paginate(mockDeliveries, params);
}

export async function getDeliveryStats(): Promise<DeliveryStats> {
  await simulateNetworkDelay();
  return {
    totalDeliveries,
    inTransitCount,
    deliveredCount,
    issuesCount,
  };
}
