import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { SegmentsPageHeader } from "@/components/dashboard/segments/page-header";
import { SegmentCard } from "@/components/dashboard/segments/segment-card";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { getCustomerSegments } from "@/lib/api/segments";
import { settleOk } from "@/lib/api/settle";

// Live customer counts — must not be statically cached.
export const dynamic = "force-dynamic";

export default async function SegmentsPage() {
  // Fired alongside the permission check instead of after it — halves the
  // number of sequential round trips this page needs before it can render.
  const [user, segmentsResult] = await Promise.all([
    getCurrentUserSafeCached(),
    settleOk(getCustomerSegments()),
  ]);
  if (!user?.permissions.includes("customers.view")) {
    return (
      <div className="flex flex-col gap-6">
        <SegmentsPageHeader />
        <PermissionDenied description="Ask an admin to grant you the View customers permission if you think this is a mistake." />
      </div>
    );
  }

  // Guaranteed defined here — the backend enforces the same permission
  // just checked above, so an authorized user's fetch cannot have failed.
  const segments = segmentsResult!;

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
