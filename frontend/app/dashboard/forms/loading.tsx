import { GenericTableSkeleton } from "@/components/dashboard/generic-table-skeleton";
import { PageHeaderSkeleton } from "@/components/dashboard/page-header-skeleton";

export default function FormsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <GenericTableSkeleton columns={5} />
    </div>
  );
}
