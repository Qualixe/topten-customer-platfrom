import { PageHeaderSkeleton } from "@/components/dashboard/page-header-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_CARDS = 8;

function TemplatesGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: SKELETON_CARDS }, (_, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-14 w-full" />
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="size-7 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TemplatesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <TemplatesGridSkeleton />
    </div>
  );
}
