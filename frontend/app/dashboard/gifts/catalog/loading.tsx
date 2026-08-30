import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SKELETON_ROWS = 8;

function GiftsTableSkeleton() {
  return (
    <div className="rounded-lg border">
      <div className="max-h-[640px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead className="w-10">
                <Skeleton className="size-4 rounded-[4px]" />
              </TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Inventory</TableHead>
              <TableHead>Redeemed</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="size-4 rounded-[4px]" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 shrink-0 rounded-md" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3.5 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3.5 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3.5 w-10" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-3.5 w-14" />
                </TableCell>
                <TableCell>
                  <Skeleton className="size-7 rounded-md" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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
          <GiftsTableSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}
