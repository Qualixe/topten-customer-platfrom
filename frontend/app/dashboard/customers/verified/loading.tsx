import { GenericTableSkeleton } from "@/components/dashboard/generic-table-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function VerifiedCustomersLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-96" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-8 w-full sm:max-w-sm" />
          <GenericTableSkeleton columns={6} />
        </CardContent>
      </Card>
    </div>
  );
}
