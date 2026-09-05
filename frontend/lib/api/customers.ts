import {
  API_BASE_URL,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  buildQueryString,
  getAuthorizationHeader,
} from "@/lib/api/client";
import { ApiError, NetworkError } from "@/lib/api/types";
import type { ApiEnvelope, ApiListEnvelope, PaginatedResponse } from "@/lib/api/types";
import type { CustomerTypeOption } from "@/lib/api/customer-types";
import type { Customer, CustomerStatus, CustomerTier } from "@/lib/mock/customers";

export type { Customer, CustomerStatus, CustomerTier } from "@/lib/mock/customers";
export type { CustomerTypeOption } from "@/lib/api/customer-types";
export { formatCurrency } from "@/lib/mock/customers";

export type CustomersSortBy = "name" | "totalSpent" | "totalOrders";
export type SortDirection = "asc" | "desc";

export interface ListCustomersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CustomerStatus | "all";
  /** Opaque customer type id (from `listCustomerTypes()`), or "all". */
  customerTypeId?: string | "all";
  sortBy?: CustomersSortBy;
  sortDir?: SortDirection;
  /** Only customers verified through at least one campaign. */
  verified?: boolean;
  /** Only customers who've opted into marketing email. */
  marketingOptIn?: boolean;
}

const DEFAULT_PAGE_SIZE = 50;

/** Shape of one item in `GET /api/v1/customers`'s `data` array, after `camelizeKeys`. */
interface CustomerDto {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  dateOfBirth: string | null;
  isVip: boolean;
  marketingOptIn: boolean;
  customerType: CustomerTypeOption;
  totalSpent: string | number;
  status: string;
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

function toStatus(status: string): CustomerStatus {
  switch (status.toLowerCase()) {
    case "inactive":
      return "Inactive";
    case "suspended":
      return "Suspended";
    default:
      return "Active";
  }
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

/** `iso` is a plain "YYYY-MM-DD" date (no time/timezone) — parsed manually
 * so a UTC-vs-local mismatch can't shift the displayed day. */
function formatBirthdayDate(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(2000, month - 1, day));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Maps a backend `CustomerDto` onto the UI-facing `Customer` shape every
 * customer component already renders. The backend doesn't track per-order
 * counts or last-purchase timestamps (only aggregate monthly spending), so
 * those fields fall back to neutral placeholders rather than being invented.
 */
function mapDtoToCustomer(dto: CustomerDto): Customer {
  return {
    id: dto.id,
    name: dto.name,
    initials: getInitials(dto.name),
    email: dto.email ?? "No email on file",
    phone: dto.phone,
    address: dto.address,
    city: dto.city,
    tier: dto.isVip ? "VIP" : "Regular",
    status: toStatus(dto.status),
    totalOrders: 0,
    totalSpent: Number(dto.totalSpent),
    joinedAt: formatJoinedDate(dto.createdAt),
    lastPurchaseAt: "—",
    notes: "",
    dateOfBirth: dto.dateOfBirth,
    customerType: dto.customerType,
    marketingOptIn: dto.marketingOptIn,
  };
}

const SORT_BY_TO_BACKEND: Record<CustomersSortBy, string | undefined> = {
  name: "name",
  totalSpent: "total_spent",
  // The backend has no order-count column to sort by; omitting `sort_by`
  // falls back to its default ordering rather than erroring.
  totalOrders: undefined,
};

/** Shared by `listCustomers` and `exportCustomersCsv` — the export must
 * apply the exact same filters as whatever page of results is on screen. */
function buildCustomersFilterQuery(
  params: Omit<ListCustomersParams, "page" | "pageSize">
): Record<string, string | number | boolean | undefined> {
  return {
    search: params.search?.trim() || undefined,
    status: params.status && params.status !== "all" ? params.status.toLowerCase() : undefined,
    customer_type_id:
      params.customerTypeId && params.customerTypeId !== "all"
        ? params.customerTypeId
        : undefined,
    sort_by: params.sortBy ? SORT_BY_TO_BACKEND[params.sortBy] : undefined,
    sort_dir: params.sortDir,
    verified: params.verified,
    marketing_opt_in: params.marketingOptIn,
  };
}

/**
 * Fetches a page of customers from `GET /api/v1/customers`, filtered, sorted,
 * and paginated server-side.
 */
export async function listCustomers(
  params: ListCustomersParams = {}
): Promise<PaginatedResponse<Customer>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const query = buildQueryString({
    page,
    page_size: pageSize,
    ...buildCustomersFilterQuery(params),
  });

  const envelope = await apiGet<ApiListEnvelope<CustomerDto>>(`/customers${query}`);

  return {
    items: envelope.data.map(mapDtoToCustomer),
    total: envelope.meta.total,
    page: envelope.meta.page,
    pageSize: envelope.meta.pageSize,
  };
}

/**
 * Downloads `GET /api/v1/customers/export` (every customer matching the
 * given filters, not just one page) as a CSV file. Bypasses `apiFetch`
 * (JSON-only) for a raw `fetch` the same way `uploadCustomerImport` does for
 * its own non-JSON request — a plain `<a href>` can't carry the
 * `Authorization` header this API requires.
 */
export async function exportCustomersCsv(
  params: Omit<ListCustomersParams, "page" | "pageSize"> = {}
): Promise<void> {
  const query = buildQueryString(buildCustomersFilterQuery(params));

  let response: Response;
  try {
    const authHeader = await getAuthorizationHeader();
    response = await fetch(`${API_BASE_URL}/customers/export${query}`, {
      headers: authHeader,
    });
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : undefined);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ApiError(body || response.statusText, response.status);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = disposition.match(/filename="?([^"]+)"?/)?.[1] ?? "customers-export.csv";

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export type ProfileStatus = "COMPLETE" | "INCOMPLETE";

/** A row on the POS Customers page (/dashboard/customers/pos) — every
 * customer in the master table, POS-imported or not. Kept separate from
 * `Customer` above (the older, mock-shaped type every other customer
 * component still uses) rather than extending it, so this new page can't
 * accidentally break anything already built on that type. */
export interface PosCustomerRow {
  id: string;
  name: string;
  phone: string;
  customerType: CustomerTypeOption;
  dateOfBirth: string | null;
  address: string | null;
  profileStatus: ProfileStatus;
  totalSpent: number;
  createdAt: string;
}

interface PosCustomerDto {
  id: string;
  name: string;
  phone: string;
  customerType: CustomerTypeOption;
  dateOfBirth: string | null;
  address: string | null;
  profileStatus: ProfileStatus;
  totalSpent: string | number;
  createdAt: string;
}

function mapDtoToPosCustomerRow(dto: PosCustomerDto): PosCustomerRow {
  return {
    id: dto.id,
    name: dto.name,
    phone: dto.phone,
    customerType: dto.customerType,
    dateOfBirth: dto.dateOfBirth,
    address: dto.address,
    profileStatus: dto.profileStatus,
    totalSpent: Number(dto.totalSpent),
    createdAt: dto.createdAt,
  };
}

export interface ListPosCustomersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  customerTypeId?: string | "all";
  profileStatus?: ProfileStatus | "all";
  createdFrom?: string;
  createdTo?: string;
}

/** GET /api/v1/customers with the profile-completeness filter — the same
 * master customer table, just the columns/filters the POS Customers page
 * needs. Server-side filtering and pagination throughout. */
export async function listPosCustomers(
  params: ListPosCustomersParams = {}
): Promise<PaginatedResponse<PosCustomerRow>> {
  const query = buildQueryString({
    page: params.page ?? 1,
    page_size: params.pageSize ?? DEFAULT_PAGE_SIZE,
    search: params.search?.trim() || undefined,
    customer_type_id:
      params.customerTypeId && params.customerTypeId !== "all"
        ? params.customerTypeId
        : undefined,
    profile_status:
      params.profileStatus && params.profileStatus !== "all" ? params.profileStatus : undefined,
    created_from: params.createdFrom,
    created_to: params.createdTo,
  });

  const envelope = await apiGet<ApiListEnvelope<PosCustomerDto>>(`/customers${query}`);

  return {
    items: envelope.data.map(mapDtoToPosCustomerRow),
    total: envelope.meta.total,
    page: envelope.meta.page,
    pageSize: envelope.meta.pageSize,
  };
}

export interface VerifiedCustomerRow {
  id: string;
  name: string;
  phone: string;
  campaignId: string;
  campaignName: string;
  customerType: CustomerTypeOption;
  verifiedAt: string;
  dateOfBirth: string | null;
  address: string | null;
  email: string | null;
}

interface VerifiedCustomerDto {
  id: string;
  name: string;
  phone: string;
  campaignId: string;
  campaignName: string;
  customerType: CustomerTypeOption;
  verifiedAt: string;
  dateOfBirth: string | null;
  address: string | null;
  email: string | null;
}

function mapDtoToVerifiedCustomerRow(dto: VerifiedCustomerDto): VerifiedCustomerRow {
  return {
    id: dto.id,
    name: dto.name,
    phone: dto.phone,
    campaignId: dto.campaignId,
    campaignName: dto.campaignName,
    customerType: dto.customerType,
    verifiedAt: dto.verifiedAt,
    dateOfBirth: dto.dateOfBirth,
    address: dto.address,
    email: dto.email,
  };
}

export interface ListVerifiedCustomersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  campaignId?: string;
  customerTypeId?: string | "all";
  verifiedFrom?: string;
  verifiedTo?: string;
}

/** One row per (customer, campaign) verified pair — a customer verified
 * through two campaigns appears twice. GET /api/v1/customers/verified. */
export async function listVerifiedCustomers(
  params: ListVerifiedCustomersParams = {}
): Promise<PaginatedResponse<VerifiedCustomerRow>> {
  const query = buildQueryString({
    page: params.page ?? 1,
    page_size: params.pageSize ?? DEFAULT_PAGE_SIZE,
    search: params.search?.trim() || undefined,
    campaign_id: params.campaignId,
    customer_type_id:
      params.customerTypeId && params.customerTypeId !== "all"
        ? params.customerTypeId
        : undefined,
    verified_from: params.verifiedFrom,
    verified_to: params.verifiedTo,
  });

  const envelope = await apiGet<ApiListEnvelope<VerifiedCustomerDto>>(`/customers/verified${query}`);

  return {
    items: envelope.data.map(mapDtoToVerifiedCustomerRow),
    total: envelope.meta.total,
    page: envelope.meta.page,
    pageSize: envelope.meta.pageSize,
  };
}

export interface CustomerStats {
  totalCustomers: number;
  vipCustomers: number;
  birthdaysThisMonth: number;
  totalRevenue: number;
}

interface CustomerStatsDto {
  totalCustomers: number;
  vipCustomers: number;
  birthdaysThisMonth: number;
  totalRevenue: string | number;
}

/** Descriptive counts for the dashboard overview, computed from real customer rows. */
export async function getCustomerStats(): Promise<CustomerStats> {
  const envelope = await apiGet<ApiEnvelope<CustomerStatsDto>>("/customers/stats");
  return {
    totalCustomers: envelope.data.totalCustomers,
    vipCustomers: envelope.data.vipCustomers,
    birthdaysThisMonth: envelope.data.birthdaysThisMonth,
    totalRevenue: Number(envelope.data.totalRevenue),
  };
}

export interface RecentCustomer extends Customer {
  /** Raw ISO timestamp, kept alongside the coarse `joinedAt` label so callers
   * that need relative time (e.g. the activity feed) don't have to re-fetch. */
  createdAt: string;
}

/** The most recently added real customers, for the dashboard overview widgets. */
export async function listRecentCustomers(limit: number = 6): Promise<RecentCustomer[]> {
  const query = buildQueryString({
    page: 1,
    page_size: limit,
    sort_by: "created_at",
    sort_dir: "desc",
  });

  const envelope = await apiGet<ApiListEnvelope<CustomerDto>>(`/customers${query}`);
  return envelope.data.map((dto) => ({ ...mapDtoToCustomer(dto), createdAt: dto.createdAt }));
}

export interface UpcomingBirthday {
  id: string;
  name: string;
  initials: string;
  tier: CustomerTier;
  date: string;
  daysAway: number;
}

interface UpcomingBirthdayDto {
  id: string;
  name: string;
  isVip: boolean;
  date: string;
  daysAway: number;
}

/** Customers with a known date of birth in the next `withinDays` days. Empty
 * until a customer profile flow starts collecting date of birth. */
export async function listUpcomingBirthdays(withinDays: number = 30): Promise<UpcomingBirthday[]> {
  const query = buildQueryString({ within_days: withinDays });
  const envelope = await apiGet<ApiListEnvelope<UpcomingBirthdayDto>>(
    `/customers/upcoming-birthdays${query}`
  );

  return envelope.data.map((dto) => ({
    id: dto.id,
    name: dto.name,
    initials: getInitials(dto.name),
    tier: dto.isVip ? "VIP" : "Regular",
    date: formatBirthdayDate(dto.date),
    daysAway: dto.daysAway,
  }));
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  /** "YYYY-MM-DD", e.g. straight from an `<input type="date">`. */
  dateOfBirth?: string;
  isVip?: boolean;
  marketingOptIn?: boolean;
  /** Omitted defaults to the built-in "General" type server-side. */
  customerTypeId?: string;
}

/** Creates a real customer row via `POST /api/v1/customers`. Throws `ApiError`
 * (e.g. invalid/duplicate phone, 422) or `NetworkError` on failure. */
export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const envelope = await apiPost<ApiEnvelope<CustomerDto>>("/customers", {
    name: input.name,
    phone: input.phone,
    email: input.email,
    address: input.address,
    city: input.city,
    date_of_birth: input.dateOfBirth,
    is_vip: input.isVip ?? false,
    marketing_opt_in: input.marketingOptIn ?? false,
    customer_type_id: input.customerTypeId,
  });

  return mapDtoToCustomer(envelope.data);
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string;
  /** `null` clears the field; `undefined` leaves it unchanged. */
  email?: string | null;
  address?: string | null;
  city?: string | null;
  dateOfBirth?: string | null;
  isVip?: boolean;
  marketingOptIn?: boolean;
  status?: CustomerStatus;
  customerTypeId?: string;
}

/** Updates a real customer row via `PATCH /api/v1/customers/{id}`. Only the
 * fields present on `input` are sent, matching the backend's partial-update
 * semantics. Throws `ApiError` (e.g. invalid/duplicate phone, 422) or
 * `NetworkError` on failure. */
export async function updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.phone !== undefined) body.phone = input.phone;
  if (input.email !== undefined) body.email = input.email;
  if (input.address !== undefined) body.address = input.address;
  if (input.city !== undefined) body.city = input.city;
  if (input.dateOfBirth !== undefined) body.date_of_birth = input.dateOfBirth;
  if (input.isVip !== undefined) body.is_vip = input.isVip;
  if (input.marketingOptIn !== undefined) body.marketing_opt_in = input.marketingOptIn;
  if (input.status !== undefined) body.status = input.status.toLowerCase();
  if (input.customerTypeId !== undefined) body.customer_type_id = input.customerTypeId;

  const envelope = await apiPatch<ApiEnvelope<CustomerDto>>(`/customers/${id}`, body);
  return mapDtoToCustomer(envelope.data);
}

/** Deletes a real customer row (and their spending history, via DB cascade)
 * via `DELETE /api/v1/customers/{id}`. */
export async function deleteCustomer(id: string): Promise<void> {
  await apiDelete<void>(`/customers/${id}`);
}
