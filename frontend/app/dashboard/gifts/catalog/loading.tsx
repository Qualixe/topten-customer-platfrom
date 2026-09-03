import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_CARDS = 10;

function GiftsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: SKELETON_CARDS }, (_, index) => (
        <div key={index} className="flex flex-col overflow-hidden rounded-lg border bg-card">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="flex flex-col gap-1.5 p-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
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
            <Skeleton className="h-8 w-full sm:w-44" />
            <Skeleton className="h-8 w-full sm:w-36" />
          </div>
          <GiftsGridSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}
