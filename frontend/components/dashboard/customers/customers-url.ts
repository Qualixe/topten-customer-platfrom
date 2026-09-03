import type { CustomerStatus, CustomersSortBy, SortDirection } from "@/lib/api/customers";

export type StatusFilter = CustomerStatus | "all";
/** An opaque customer type id (from `listCustomerTypes()`), or "all". */
export type CustomerTypeFilter = string;

export interface CustomersUrlParams {
  search: string;
  status: StatusFilter;
  customerTypeId: CustomerTypeFilter;
  sortBy?: CustomersSortBy;
  sortDir: SortDirection;
  page: number;
}

const CUSTOMERS_PATH = "/dashboard/customers";

/**
 * Builds the next `/dashboard/customers` URL for a partial change to the
 * current search/filter/sort/page state. Search, filter, and sort changes
 * reset pagination back to page 1; a page-only change does not.
 */
export function buildCustomersHref(
  current: CustomersUrlParams,
  patch: Partial<CustomersUrlParams>
): string {
  const next: CustomersUrlParams = { ...current, ...patch };

  const changedNonPageField = Object.keys(patch).some((key) => key !== "page");
  if (changedNonPageField) {
    next.page = 1;
  }

  const params = new URLSearchParams();
  if (next.search.trim().length > 0) params.set("search", next.search.trim());
  if (next.status !== "all") params.set("status", next.status);
  if (next.customerTypeId !== "all") params.set("customerTypeId", next.customerTypeId);
  if (next.sortBy) {
    params.set("sortBy", next.sortBy);
    params.set("sortDir", next.sortDir);
  }
  if (next.page > 1) params.set("page", String(next.page));

  const query = params.toString();
  return query.length > 0 ? `${CUSTOMERS_PATH}?${query}` : CUSTOMERS_PATH;
}
