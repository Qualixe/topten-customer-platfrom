import { CouriersPageHeader } from "@/components/dashboard/couriers/page-header";
import { StatsGridSkeleton } from "@/components/dashboard/stats-grid-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROWS = 8;

function DeliveriesDirectorySkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-8 flex-1 sm:max-w-sm" />
          <Skeleton className="h-8 w-full sm:w-36" />
        </div>
        {/* Table */}
        <div className="rounded-lg border">
          <div className="max-h-[560px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Tracking Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Gift</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: ROWS }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-3.5 w-28 font-mono" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-8 shrink-0 rounded-full" />
                        <div className="flex flex-col gap-1.5">
                          <Skeleton className="h-3.5 w-28" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-3.5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-3.5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto size-7 rounded-md" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CouriersLoading() {
  return (
    <div className="flex flex-col gap-6">
      <CouriersPageHeader />
      <StatsGridSkeleton count={4} />
      <DeliveriesDirectorySkeleton />
    </div>
  );
}
