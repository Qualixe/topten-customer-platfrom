import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the layout of `SmsBalanceCard` while data loads. */
export function SmsBalanceCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-3.5 w-52" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </CardContent>
    </Card>
  );
}
