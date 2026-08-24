import { ArrowLeft } from "lucide-react";

import { PageHeaderSkeleton } from "@/components/dashboard/page-header-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function StepIndicatorSkeleton() {
  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center gap-0">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5 px-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="hidden h-3 w-10 sm:block" />
            </div>
            {i < 3 && <Skeleton className="h-px w-8 md:w-16" />}
          </div>
        ))}
      </div>
    </div>
  );
}

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

export default function NewCampaignLoading() {
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

      <StepIndicatorSkeleton />

      {/* Separator */}
      <Skeleton className="h-px w-full" />

      <ComposerCardSkeleton />

      {/* Nav buttons */}
      <div className="flex justify-end">
        <Skeleton className="h-8 w-44" />
      </div>
    </div>
  );
}
