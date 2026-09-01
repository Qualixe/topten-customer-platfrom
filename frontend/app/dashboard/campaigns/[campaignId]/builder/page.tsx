import nextDynamic from "next/dynamic";
import { notFound } from "next/navigation";

import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { getCampaignLandingPage } from "@/lib/api/campaign-landing-pages";
import { getCampaign } from "@/lib/api/campaigns";
import { settleOk } from "@/lib/api/settle";
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

  // Fired alongside the permission check instead of after it — collapses
  // what were up to four sequential round trips into one parallel batch.
  // The 404 case is carried through as a sentinel rather than left to
  // reject, so Promise.all doesn't also discard the other results.
  const NOT_FOUND = "__not_found__" as const;
  const [user, campaignResult, landingPageResult, logoUrl] = await Promise.all([
    getCurrentUserSafeCached(),
    getCampaign(campaignId).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return NOT_FOUND;
      throw err;
    }),
    settleOk(getCampaignLandingPage(campaignId)),
    getResolvedLogoUrlSafe(),
  ]);
  if (!user?.permissions.includes("campaigns.view")) {
    return (
      <div className="flex flex-col gap-6">
        <PermissionDenied description="Ask an admin to grant you the View SMS campaigns permission if you think this is a mistake." />
      </div>
    );
  }

  if (campaignResult === NOT_FOUND) notFound();
  const campaign = campaignResult;
  // Guaranteed defined here — the backend enforces the same permission
  // just checked above, so an authorized user's fetch cannot have failed.
  const landingPage = landingPageResult!;

  return (
    <Builder
      campaignId={campaignId}
      campaignName={campaign.name}
      initialLandingPage={landingPage}
      logoUrl={logoUrl}
    />
  );
}
