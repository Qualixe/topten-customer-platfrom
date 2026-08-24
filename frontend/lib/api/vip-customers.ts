import { paginate, simulateNetworkDelay } from "@/lib/api/client";
import type { PaginatedResponse, PaginationParams } from "@/lib/api/types";
import {
  atRiskVipCount,
  averageVipSpend,
  mockVipCustomers,
  totalVipCustomers,
  totalVipRevenue,
  type VipCustomer,
} from "@/lib/mock/vip-customers";

export type { VipCustomer, VipLevel, VipStatus } from "@/lib/mock/vip-customers";
export { formatCurrency } from "@/lib/mock/vip-customers";

export interface VipCustomerStats {
  totalCustomers: number;
  totalRevenue: number;
  averageSpend: number;
  atRiskCount: number;
}

/**
 * Fetches a page of VIP customers.
 *
 * Backed by in-memory mock data for now — swap for `apiFetch` once
 * `/vip-customers` exists on the backend.
 */
export async function listVipCustomers(
  params: PaginationParams = {}
): Promise<PaginatedResponse<VipCustomer>> {
  await simulateNetworkDelay();
  return paginate(mockVipCustomers, params);
}

export async function getVipCustomerStats(): Promise<VipCustomerStats> {
  await simulateNetworkDelay();
  return {
    totalCustomers: totalVipCustomers,
    totalRevenue: totalVipRevenue,
    averageSpend: averageVipSpend,
    atRiskCount: atRiskVipCount,
  };
}
