import { GiftsPageHeader } from "@/components/dashboard/gifts/page-header";
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

const ROWS = 5;

function PendingOrdersSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-52" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="flex flex-col items-end gap-1">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function GiftsCatalogSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-8 flex-1 sm:max-w-sm" />
          <Skeleton className="h-8 w-full sm:w-36" />
          <Skeleton className="h-8 w-full sm:w-36" />
        </div>
        {/* Table */}
        <div className="rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Gift</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Points Cost</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Redeemed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: ROWS }, (_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-9 shrink-0 rounded-md" />
                      <div className="flex flex-col gap-1.5">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-3.5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-8" /></TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto size-7 rounded-md" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GiftsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <GiftsPageHeader />
      <StatsGridSkeleton count={4} />
      <PendingOrdersSkeleton />
      <GiftsCatalogSkeleton />
    </div>
  );
}
