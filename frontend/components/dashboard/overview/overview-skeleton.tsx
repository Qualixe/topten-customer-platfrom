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
import { PageHeaderSkeleton } from "@/components/dashboard/page-header-skeleton";
import { StatsGridSkeleton } from "@/components/dashboard/stats-grid-skeleton";

/** Skeleton for the two side-by-side cards (UpcomingBirthdays + RecentActivity). */
function TwoColumnCardsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Upcoming birthdays */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-1">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col gap-0">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex gap-3 pb-4">
              <div className="flex flex-col items-center">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                {i < 4 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-52" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** Skeleton for the CustomerOverview table card at the bottom of the page. */
function CustomerOverviewSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-44" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Total Spent</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }, (_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <div className="flex flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-3.5 w-8" /></TableCell>
                <TableCell><Skeleton className="h-3.5 w-16" /></TableCell>
                <TableCell><Skeleton className="h-3.5 w-16" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * Full-page skeleton for the dashboard overview (`/dashboard`).
 * Matches the layout: PageHeader → StatsGrid → 2-col cards → CustomerOverview table.
 */
export function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <StatsGridSkeleton count={4} />
      <TwoColumnCardsSkeleton />
      <CustomerOverviewSkeleton />
    </div>
  );
}
