import { Suspense } from "react";

import { CustomersFilterBar } from "@/components/dashboard/customers/customers-filter-bar";
import { CustomersPageHeader } from "@/components/dashboard/customers/page-header";
import { CustomersResults } from "@/components/dashboard/customers/customers-results";
import { CustomersTableSkeleton } from "@/components/dashboard/customers/customers-table-skeleton";
import type { CustomersUrlParams } from "@/components/dashboard/customers/customers-url";
import type { CustomersSortBy } from "@/lib/api/customers";

type RawSearchParams = Record<string, string | string[] | undefined>;

const SORTABLE_COLUMNS: CustomersSortBy[] = ["name", "totalSpent", "totalOrders"];

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseParams(searchParams: RawSearchParams): CustomersUrlParams {
  const rawSortBy = firstValue(searchParams.sortBy);
  const sortBy = SORTABLE_COLUMNS.find((column) => column === rawSortBy);
  const rawPage = Number(firstValue(searchParams.page));

  return {
    search: firstValue(searchParams.search) ?? "",
    status:
      (firstValue(searchParams.status) as CustomersUrlParams["status"]) ?? "all",
    customerTypeId: firstValue(searchParams.customerTypeId) ?? "all",
    sortBy,
    sortDir: firstValue(searchParams.sortDir) === "desc" ? "desc" : "asc",
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1,
  };
}

export default async function CustomersPage(
  props: PageProps<"/dashboard/customers">
) {
  const rawSearchParams = await props.searchParams;
  const current = parseParams(rawSearchParams);
  const suspenseKey = JSON.stringify(current);

  return (
    <div className="flex flex-col gap-6">
      <CustomersPageHeader />
      <CustomersFilterBar current={current} />
      <Suspense key={suspenseKey} fallback={<CustomersTableSkeleton />}>
        <CustomersResults current={current} />
      </Suspense>
    </div>
  );
}
