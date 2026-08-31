import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { SegmentsPageHeader } from "@/components/dashboard/segments/page-header";
import { SegmentCard } from "@/components/dashboard/segments/segment-card";
import { getCurrentUserSafe } from "@/lib/api/auth";
import { getCustomerSegments } from "@/lib/api/segments";

// Live customer counts — must not be statically cached.
export const dynamic = "force-dynamic";

export default async function SegmentsPage() {
  const user = await getCurrentUserSafe();
  if (!user?.permissions.includes("customers.view")) {
    return (
      <div className="flex flex-col gap-6">
        <SegmentsPageHeader />
        <PermissionDenied description="Ask an admin to grant you the View customers permission if you think this is a mistake." />
      </div>
    );
  }

  const segments = await getCustomerSegments();

  return (
    <div className="flex flex-col gap-6">
      <SegmentsPageHeader />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SegmentCard title="By Status" buckets={segments.byStatus} />
        <SegmentCard title="By City" buckets={null} />
        <SegmentCard title="By Group" buckets={null} />
        <SegmentCard title="By Tier" buckets={segments.byTier} />
        <SegmentCard title="By Gender" buckets={null} />
        <SegmentCard title="By Tag" buckets={null} />
      </div>
    </div>
  );
}
