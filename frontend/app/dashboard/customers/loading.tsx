import { CustomersPageHeader } from "@/components/dashboard/customers/page-header";
import { CustomersTableSkeleton } from "@/components/dashboard/customers/customers-table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return (
    <div className="flex flex-col gap-6">
      <CustomersPageHeader />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-8 flex-1 sm:max-w-sm" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-full sm:w-36" />
          <Skeleton className="h-8 w-full sm:w-36" />
        </div>
      </div>
      <CustomersTableSkeleton />
    </div>
  );
}
