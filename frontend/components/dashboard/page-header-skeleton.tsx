import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the two-line heading + action-button row used by every page header
 * component (CampaignsPageHeader, BirthdaysPageHeader, etc.).
 */
export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-8 w-36 shrink-0" />
    </div>
  );
}
