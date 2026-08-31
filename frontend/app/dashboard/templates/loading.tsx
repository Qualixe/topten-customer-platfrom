import { GenericTableSkeleton } from "@/components/dashboard/generic-table-skeleton";
import { PageHeaderSkeleton } from "@/components/dashboard/page-header-skeleton";

export default function TemplatesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <GenericTableSkeleton columns={4} />
    </div>
  );
}
