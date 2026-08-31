import { UserPlus } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { RecentCustomer } from "@/lib/api/customers";

/**
 * The backend has no general activity/audit log yet (gifts, campaigns, and
 * VIP upgrades aren't tracked as events) — so "recent activity" is derived
 * from the one real event that does exist: a customer record being created.
 */
function relativeTimeFrom(iso: string): string {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return "";

  const diffMs = Date.now() - created;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function RecentActivity({ recentCustomers }: { recentCustomers: RecentCustomer[] }) {
  return (
    <Card className="flex flex-1 flex-col">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Newly added customers</CardDescription>
      </CardHeader>
      <CardContent>
        {recentCustomers.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No activity yet"
            description="New customers will show up here as they're added to the platform."
          />
        ) : (
          <ul className="flex flex-col">
            {recentCustomers.map((customer, index) => {
              const isLast = index === recentCustomers.length - 1;

              return (
                <li key={customer.id} className="flex gap-3 rounded-lg px-1.5 transition-colors hover:bg-muted/50">
                  <div className="flex flex-col items-center pt-1">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserPlus className="size-4" aria-hidden="true" />
                    </span>
                    {!isLast && (
                      <span className="w-px flex-1 bg-border" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 py-1 pb-4">
                    <p className="text-sm font-medium">New customer added</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {customer.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {relativeTimeFrom(customer.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
