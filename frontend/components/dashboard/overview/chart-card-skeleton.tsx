import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder shown while a chart's own JS chunk (recharts is lazy-loaded
 * — see app/dashboard/page.tsx) is still being fetched. Matches the real
 * chart cards' header + body proportions so nothing jumps once it swaps in. */
export function ChartCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="mb-4 h-8 w-20" />
        <Skeleton className="h-44 w-full" />
      </CardContent>
    </Card>
  );
}
