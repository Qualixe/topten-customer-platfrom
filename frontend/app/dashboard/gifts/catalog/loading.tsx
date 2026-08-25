import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const CARDS = 8;

function GiftCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-8 w-full" />
      </CardContent>
      <CardContent className="flex items-end justify-between pt-0">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-14" />
        </div>
        <Skeleton className="h-3 w-8" />
      </CardContent>
    </Card>
  );
}

export default function GiftCatalogLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" disabled>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Skeleton className="h-8 flex-1 sm:max-w-sm" />
            <Skeleton className="h-8 w-full sm:w-36" />
            <Skeleton className="h-8 w-full sm:w-36" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: CARDS }, (_, i) => (
              <GiftCardSkeleton key={i} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
