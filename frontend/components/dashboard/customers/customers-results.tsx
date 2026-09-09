import { CustomersDirectory } from "@/components/dashboard/customers/customers-directory";
import type { CustomersUrlParams } from "@/components/dashboard/customers/customers-url";
import { listCustomers } from "@/lib/api/customers";
import { SPEND_RANGES } from "@/lib/spend-ranges";

/**
 * Fetches exactly one page of customers for the current URL state. Rendered
 * inside a `<Suspense>` boundary keyed to that state, so navigating to a new
 * search/filter/sort/page combination re-suspends this component and shows
 * the table skeleton until the new page resolves.
 */
export async function CustomersResults({
  current,
}: {
  current: CustomersUrlParams;
}) {
  const spendRange = SPEND_RANGES.find((range) => range.key === current.spendRange);

  const { items, total, page, pageSize } = await listCustomers({
    page: current.page,
    search: current.search,
    status: current.status,
    customerTypeId: current.customerTypeId,
    city: current.city,
    minTotalSpent: spendRange?.min,
    maxTotalSpent: spendRange?.max,
    sortBy: current.sortBy,
    sortDir: current.sortDir,
  });

  return (
    <CustomersDirectory
      customers={items}
      total={total}
      page={page}
      pageSize={pageSize}
      current={current}
    />
  );
}
