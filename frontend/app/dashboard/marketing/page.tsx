import { MarketingPageClient } from "@/components/dashboard/marketing/marketing-page-client";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { settleOk } from "@/lib/api/settle";
import { listSendGridCampaigns } from "@/lib/api/sendgrid";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const [user, campaignsResult] = await Promise.all([
    getCurrentUserSafeCached(),
    settleOk(listSendGridCampaigns()),
  ]);
  if (!user?.permissions.includes("marketing.view")) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Marketing</h2>
        <PermissionDenied description="Ask an admin to grant you the View SendGrid marketing permission if you think this is a mistake." />
      </div>
    );
  }

  return (
    <MarketingPageClient
      initialCampaigns={campaignsResult ?? []}
      canManage={user.permissions.includes("marketing.manage")}
    />
  );
}
