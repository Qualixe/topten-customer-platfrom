import { ImportsPageHeader } from "@/components/dashboard/imports/page-header";
import { ImportsWorkspace } from "@/components/dashboard/imports/imports-workspace";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { getCurrentUserSafe } from "@/lib/api/auth";
import { listImportBatches } from "@/lib/api/imports";

// Real, frequently-changing backend data — must not be statically cached.
export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const user = await getCurrentUserSafe();
  if (!user?.permissions.includes("imports.manage")) {
    return (
      <div className="flex flex-col gap-6">
        <ImportsPageHeader />
        <PermissionDenied description="Ask an admin to grant you the Import customer data permission if you think this is a mistake." />
      </div>
    );
  }

  const { items } = await listImportBatches(20);

  return (
    <div className="flex flex-col gap-6">
      <ImportsPageHeader />
      <ImportsWorkspace initialHistory={items} />
    </div>
  );
}
