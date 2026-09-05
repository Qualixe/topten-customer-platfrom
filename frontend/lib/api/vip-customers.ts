import { apiGet, buildQueryString } from "@/lib/api/client";
import type { CustomerTypeOption } from "@/lib/api/customer-types";
import type { ApiEnvelope, ApiListEnvelope, PaginatedResponse } from "@/lib/api/types";

/** The customer's real, admin-manageable customer type name (POS-import-
 * driven, or set on the customer form). Independent of the `is_vip` flag
 * that puts a customer on this page at all — a customer can be manually
 * flagged VIP while still classified under any other type — so this is
 * shown as-is rather than treated as a "level" of VIP-ness. Not restricted
 * to General/VIP/VVIP since admins can add arbitrary types. */
export type CustomerSegment = string;

export type VipStatus = "Active" | "At Risk" | "Inactive";

export interface VipCustomer {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  phone: string;
  city: string;
  segment: CustomerSegment;
  status: VipStatus;
  totalSpent: number;
  /** e.g. "Jul 2026", derived from their most recent non-zero recorded
   * spending month. "No recent activity" if they have no spending history. */
  lastPurchaseLabel: string;
  /** e.g. "Jan 2021", from the customer's real `created_at`. */
  memberSince: string;
}

export interface VipCustomerStats {
  totalCustomers: number;
  totalRevenue: number;
  averageSpend: number;
  atRiskCount: number;
}

export interface ListVipCustomersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: VipStatus | "all";
}

interface VipCustomerDto {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  city: string | null;
  customerType: CustomerTypeOption;
  status: "ACTIVE" | "AT_RISK" | "INACTIVE";
  totalSpent: string | number;
  lastPurchaseYear: number | null;
  lastPurchaseMonth: number | null;
  memberSince: string;
}

interface VipCustomerStatsDto {
  totalVipCustomers: number;
  totalVipRevenue: string | number;
  averageSpend: string | number;
  atRiskCount: number;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const STATUS_FROM_BACKEND: Record<VipCustomerDto["status"], VipStatus> = {
  ACTIVE: "Active",
  AT_RISK: "At Risk",
  INACTIVE: "Inactive",
};

const STATUS_TO_BACKEND: Record<VipStatus, VipCustomerDto["status"]> = {
  Active: "ACTIVE",
  "At Risk": "AT_RISK",
  Inactive: "INACTIVE",
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

/** Always rendered in Asia/Dhaka time — the store operates only in
 * Bangladesh, regardless of the server's own system timezone. */
function formatJoinedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
}

function formatLastPurchase(year: number | null, month: number | null): string {
  if (year === null || month === null) return "No recent activity";
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

function mapDtoToVipCustomer(dto: VipCustomerDto): VipCustomer {
  return {
    id: dto.id,
    name: dto.name,
    initials: getInitials(dto.name),
    email: dto.email,
    phone: dto.phone,
    city: dto.city ?? "—",
    segment: dto.customerType.name,
    status: STATUS_FROM_BACKEND[dto.status],
    totalSpent: Number(dto.totalSpent),
    lastPurchaseLabel: formatLastPurchase(dto.lastPurchaseYear, dto.lastPurchaseMonth),
    memberSince: formatJoinedDate(dto.memberSince),
  };
}

/** Fetches a page of VIP-flagged customers from `GET /api/v1/customers/vip`,
 * filtered, sorted (by total spend, highest first), and paginated server-side. */
export async function listVipCustomers(
  params: ListVipCustomersParams = {}
): Promise<PaginatedResponse<VipCustomer>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;

  const query = buildQueryString({
    page,
    page_size: pageSize,
    search: params.search?.trim() || undefined,
    vip_status: params.status && params.status !== "all" ? STATUS_TO_BACKEND[params.status] : undefined,
  });

  const envelope = await apiGet<ApiListEnvelope<VipCustomerDto>>(`/customers/vip${query}`);

  return {
    items: envelope.data.map(mapDtoToVipCustomer),
    total: envelope.meta.total,
    page: envelope.meta.page,
    pageSize: envelope.meta.pageSize,
  };
}

export async function getVipCustomerStats(): Promise<VipCustomerStats> {
  const envelope = await apiGet<ApiEnvelope<VipCustomerStatsDto>>("/customers/vip/stats");
  return {
    totalCustomers: envelope.data.totalVipCustomers,
    totalRevenue: Number(envelope.data.totalVipRevenue),
    averageSpend: Number(envelope.data.averageSpend),
    atRiskCount: envelope.data.atRiskCount,
  };
}

export function formatCurrency(value: number): string {
  return `৳${value.toLocaleString("en-US")}`;
}
