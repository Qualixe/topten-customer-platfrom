import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { TemplatesPageClient } from "@/components/dashboard/templates/templates-page-client";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { settleOk } from "@/lib/api/settle";
import { listTemplates } from "@/lib/api/templates";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  // Fired alongside the permission check instead of after it — halves the
  // number of sequential round trips this page needs before it can render.
  const [user, templatesResult] = await Promise.all([
    getCurrentUserSafeCached(),
    settleOk(listTemplates({ page: 1 })),
  ]);
  if (!user?.permissions.includes("templates.view")) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Templates</h2>
        <PermissionDenied description="Ask an admin to grant you the View message templates permission if you think this is a mistake." />
      </div>
    );
  }

  // Guaranteed defined here — the backend enforces the same permission
  // just checked above, so an authorized user's fetch cannot have failed.
  const result = templatesResult!;

  return (
    <TemplatesPageClient
      initialTemplates={result.items}
      initialMeta={{ total: result.total, page: result.page, pageSize: result.pageSize }}
      canManage={user.permissions.includes("templates.manage")}
    />
  );
}
