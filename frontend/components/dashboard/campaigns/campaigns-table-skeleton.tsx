import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SKELETON_ROWS = 6;

/**
 * Mirrors the `CampaignsDirectory` card (toolbar + table) while data loads.
 * Used as the Suspense fallback and in the campaigns loading.tsx.
 */
export function CampaignsTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-8 flex-1 sm:max-w-sm" />
          <Skeleton className="h-8 w-full sm:w-44" />
        </div>

        {/* Table */}
        <div className="rounded-lg border">
          <div className="max-h-[560px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>SMS Count</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <TableRow key={i}>
                    {/* Campaign name + message */}
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <Skeleton className="h-3.5 w-36" />
                        <Skeleton className="h-3 w-52" />
                      </div>
                    </TableCell>
                    {/* Audience */}
                    <TableCell>
                      <Skeleton className="h-3.5 w-24" />
                    </TableCell>
                    {/* Recipients */}
                    <TableCell>
                      <Skeleton className="h-3.5 w-12" />
                    </TableCell>
                    {/* SMS Count */}
                    <TableCell>
                      <Skeleton className="h-3.5 w-14" />
                    </TableCell>
                    {/* Status */}
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    {/* Date */}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-3 w-14" />
                      </div>
                    </TableCell>
                    {/* Cost */}
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-3.5 w-16" />
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
