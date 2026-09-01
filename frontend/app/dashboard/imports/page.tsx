import { ImportsPageHeader } from "@/components/dashboard/imports/page-header";
import { ImportsWorkspace } from "@/components/dashboard/imports/imports-workspace";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { listImportBatches } from "@/lib/api/imports";
import { settleOk } from "@/lib/api/settle";

// Real, frequently-changing backend data — must not be statically cached.
export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  // Fired alongside the permission check instead of after it — halves the
  // number of sequential round trips this page needs before it can render.
  const [user, batchesResult] = await Promise.all([
    getCurrentUserSafeCached(),
    settleOk(listImportBatches(20)),
  ]);
  if (!user?.permissions.includes("imports.manage")) {
    return (
      <div className="flex flex-col gap-6">
        <ImportsPageHeader />
        <PermissionDenied description="Ask an admin to grant you the Import customer data permission if you think this is a mistake." />
      </div>
    );
  }

  // Guaranteed defined here — the backend enforces the same permission
  // just checked above, so an authorized user's fetch cannot have failed.
  const { items } = batchesResult!;

  return (
    <div className="flex flex-col gap-6">
      <ImportsPageHeader />
      <ImportsWorkspace initialHistory={items} />
    </div>
  );
}
