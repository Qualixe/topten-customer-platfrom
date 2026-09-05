import { MarketingPageClient } from "@/components/dashboard/marketing/marketing-page-client";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { getCurrentUserSafeCached } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const user = await getCurrentUserSafeCached();
  if (!user?.permissions.includes("marketing.view")) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Marketing</h2>
        <PermissionDenied description="Ask an admin to grant you the View marketing permission if you think this is a mistake." />
      </div>
    );
  }

  return <MarketingPageClient canManage={user.permissions.includes("marketing.manage")} />;
}
