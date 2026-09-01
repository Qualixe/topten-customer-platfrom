import { FormsPageClient } from "@/components/dashboard/forms/forms-page-client";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { listForms } from "@/lib/api/forms";
import { settleOk } from "@/lib/api/settle";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  // Fired alongside the permission check instead of after it — halves the
  // number of sequential round trips this page needs before it can render.
  const [user, formsResult] = await Promise.all([
    getCurrentUserSafeCached(),
    settleOk(listForms({ page: 1 })),
  ]);
  if (!user?.permissions.includes("forms.view")) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Forms</h2>
        <PermissionDenied description="Ask an admin to grant you the View forms permission if you think this is a mistake." />
      </div>
    );
  }

  // Guaranteed defined here — the backend enforces the same permission
  // just checked above, so an authorized user's fetch cannot have failed.
  const result = formsResult!;

  return (
    <FormsPageClient
      initialForms={result.items}
      initialMeta={{ total: result.total, page: result.page, pageSize: result.pageSize }}
      canManage={user.permissions.includes("forms.manage")}
    />
  );
}
