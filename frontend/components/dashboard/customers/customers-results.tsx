import { CustomersDirectory } from "@/components/dashboard/customers/customers-directory";
import type { CustomersUrlParams } from "@/components/dashboard/customers/customers-url";
import { listCustomers } from "@/lib/api/customers";

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
  const { items, total, page, pageSize } = await listCustomers({
    page: current.page,
    search: current.search,
    tier: current.tier,
    status: current.status,
    customerTypeId: current.customerTypeId,
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
