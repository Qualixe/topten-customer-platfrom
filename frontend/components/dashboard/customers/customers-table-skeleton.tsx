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

/**
 * Mirrors the shape of `CustomersDirectory` (table + pagination footer) so
 * there's no layout jump between this fallback and the real content. Shown
 * by the `<Suspense>` boundary in the customers page while a server-side
 * `listCustomers()` call for the current search/filter/sort/page is
 * in flight.
 */
export function CustomersTableSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border">
        <div className="max-h-[560px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-8 shrink-0 rounded-full" />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3.5 w-8" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3.5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3.5 w-16" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto size-7 rounded-md" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-56" />
      </div>
    </div>
  );
}
