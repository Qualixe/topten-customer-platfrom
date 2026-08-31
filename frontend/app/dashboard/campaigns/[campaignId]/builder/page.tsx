import nextDynamic from "next/dynamic";
import { notFound } from "next/navigation";

import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUserSafe } from "@/lib/api/auth";
import { getCampaignLandingPage } from "@/lib/api/campaign-landing-pages";
import { getCampaign } from "@/lib/api/campaigns";
import { getResolvedLogoUrlSafe } from "@/lib/api/site-settings";
import { ApiError } from "@/lib/api/types";

// The builder (blocks, drag-and-drop, live preview) is a big client-only
// bundle used on this one route — code-split so every other page never
// pays for it.
const Builder = nextDynamic(
  () => import("@/components/campaign-builder/Builder").then((m) => m.Builder),
  { loading: () => <Skeleton className="h-[calc(100vh-8rem)] w-full" /> }
);

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
  const logoUrl = await getResolvedLogoUrlSafe();

  return (
    <Builder
      campaignId={campaignId}
      campaignName={campaign.name}
      initialLandingPage={landingPage}
      logoUrl={logoUrl}
    />
  );
}
