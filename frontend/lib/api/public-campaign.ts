import { apiGet } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/types";
import type { BuilderData } from "@/lib/api/campaign-landing-pages";

/** Content only — no campaign id, no recipient info. Used by the public
 * /campaign/[slug] page. */
export interface PublicLandingPage {
  name: string;
  builderData: BuilderData;
}

export async function getPublicCampaignLandingPage(slug: string): Promise<PublicLandingPage> {
  const envelope = await apiGet<ApiEnvelope<PublicLandingPage>>(
    `/public/campaign-landing-page/${encodeURIComponent(slug)}`
  );
  return envelope.data;
}
