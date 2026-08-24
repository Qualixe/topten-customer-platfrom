import { SettingsPageHeader } from "@/components/dashboard/settings/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function SettingsTabsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {/* Tab list */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 w-fit">
        {["General", "Customers", "Birthdays", "VIP", "Notifications", "Couriers", "Account"].map((label) => (
          <Skeleton key={label} className="h-6 w-20 rounded-md" />
        ))}
      </div>

      {/* Tab panel */}
      <Card className="mt-2">
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-full max-w-sm" />
            </div>
          ))}
          <Skeleton className="h-8 w-24 self-start" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SettingsPageHeader />
      <SettingsTabsSkeleton />
    </div>
  );
}
