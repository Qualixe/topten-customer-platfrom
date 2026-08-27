import { FormsPageClient } from "@/components/dashboard/forms/forms-page-client";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { getCurrentUserSafe } from "@/lib/api/auth";
import { listForms } from "@/lib/api/forms";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  const user = await getCurrentUserSafe();
  if (!user?.permissions.includes("forms.view")) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Forms</h2>
        <PermissionDenied description="Ask an admin to grant you the View forms permission if you think this is a mistake." />
      </div>
    );
  }

  const result = await listForms({ page: 1 });

  return (
    <FormsPageClient
      initialForms={result.items}
      initialMeta={{ total: result.total, page: result.page, pageSize: result.pageSize }}
      canManage={user.permissions.includes("forms.manage")}
    />
  );
}
