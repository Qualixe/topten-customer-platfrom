import { ImportsPageHeader } from "@/components/dashboard/imports/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function ImportWorkspaceSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Upload card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Drop zone */}
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>

      {/* History card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
              <Skeleton className="size-8 shrink-0 rounded-md" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ImportsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <ImportsPageHeader />
      <ImportWorkspaceSkeleton />
    </div>
  );
}
