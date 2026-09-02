import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Mirrors the `StatsGrid` card layout. Pass `count` to match the number of
 * stat cards on a given page (default 4) — also controls the `lg` column
 * count so the skeleton doesn't wrap differently than the real grid.
 */
export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        count >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="size-4 rounded-sm" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
