import { BirthdaysPageHeader } from "@/components/dashboard/birthdays/page-header";
import { PageHeaderSkeleton } from "@/components/dashboard/page-header-skeleton";
import { StatsGridSkeleton } from "@/components/dashboard/stats-grid-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function BirthdaysTwoColSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 5 }, (_, j) => (
              <div key={j} className="flex items-center gap-3 px-2 py-1">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BirthdaysExplorerSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Calendar placeholder */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </Card>

      {/* Table placeholder */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-28" />
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function BirthdaysLoading() {
  return (
    <div className="flex flex-col gap-6">
      <BirthdaysPageHeader />
      <StatsGridSkeleton count={4} />
      <BirthdaysTwoColSkeleton />
      <BirthdaysExplorerSkeleton />
    </div>
  );
}
