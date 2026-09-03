import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function ComposerCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function QuickSendLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Back button + heading */}
      <div className="flex items-center gap-3">
        <Skeleton className="size-7 shrink-0 rounded-lg" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <ComposerCardSkeleton />
      <ComposerCardSkeleton />
      <ComposerCardSkeleton />
    </div>
  );
}
