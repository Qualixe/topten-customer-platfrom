import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { TemplatesPageClient } from "@/components/dashboard/templates/templates-page-client";
import { getCurrentUserSafe } from "@/lib/api/auth";
import { listTemplates } from "@/lib/api/templates";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await getCurrentUserSafe();
  if (!user?.permissions.includes("templates.view")) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Templates</h2>
        <PermissionDenied description="Ask an admin to grant you the View message templates permission if you think this is a mistake." />
      </div>
    );
  }

  const result = await listTemplates({ page: 1 });

  return (
    <TemplatesPageClient
      initialTemplates={result.items}
      initialMeta={{ total: result.total, page: result.page, pageSize: result.pageSize }}
      canManage={user.permissions.includes("templates.manage")}
    />
  );
}
