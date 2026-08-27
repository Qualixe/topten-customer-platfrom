import { notFound } from "next/navigation";

import { Builder } from "@/components/campaign-builder/Builder";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { getCurrentUserSafe } from "@/lib/api/auth";
import { getCampaignLandingPage } from "@/lib/api/campaign-landing-pages";
import { getCampaign } from "@/lib/api/campaigns";
import { ApiError } from "@/lib/api/types";

export const dynamic = "force-dynamic";

export default async function CampaignBuilderPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  const user = await getCurrentUserSafe();
  if (!user?.permissions.includes("campaigns.view")) {
    return (
      <div className="flex flex-col gap-6">
        <PermissionDenied description="Ask an admin to grant you the View SMS campaigns permission if you think this is a mistake." />
      </div>
    );
  }

  let campaign;
  try {
    campaign = await getCampaign(campaignId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const landingPage = await getCampaignLandingPage(campaignId);

  return (
    <Builder campaignId={campaignId} campaignName={campaign.name} initialLandingPage={landingPage} />
  );
}
