import { GiftsPageHeader } from "@/components/dashboard/gifts/page-header";
import { StatsGridSkeleton } from "@/components/dashboard/stats-grid-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function PendingOrdersSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-52" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="flex flex-col items-end gap-1">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function GiftsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <GiftsPageHeader />
      <StatsGridSkeleton count={4} />
      <PendingOrdersSkeleton />
    </div>
  );
}
