import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/types";
import { ApiError } from "@/lib/api/types";
import type { Block } from "@/components/campaign-builder/types";

export interface BuilderData {
  version: number;
  blocks: Block[];
}

export interface CampaignLandingPage {
  id: string;
  campaignId: string;
  name: string;
  slug: string;
  builderData: BuilderData;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveLandingPageInput {
  name: string;
  slug: string;
  builderData: BuilderData;
  published: boolean;
}

/** Null (not an error) when the campaign has no landing page yet — that's
 * a normal state for a campaign that hasn't been set up in the builder. */
export async function getCampaignLandingPage(
  campaignId: string
): Promise<CampaignLandingPage | null> {
  try {
    const envelope = await apiGet<ApiEnvelope<CampaignLandingPage>>(
      `/sms/campaigns/${campaignId}/landing-page`
    );
    return envelope.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function createCampaignLandingPage(
  campaignId: string,
  input: SaveLandingPageInput
): Promise<CampaignLandingPage> {
  const envelope = await apiPost<ApiEnvelope<CampaignLandingPage>>(
    `/sms/campaigns/${campaignId}/landing-page`,
    {
      name: input.name,
      slug: input.slug,
      builder_data: input.builderData,
      published: input.published,
    }
  );
  return envelope.data;
}

export async function updateCampaignLandingPage(
  campaignId: string,
  input: Partial<SaveLandingPageInput>
): Promise<CampaignLandingPage> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.slug !== undefined) body.slug = input.slug;
  if (input.builderData !== undefined) body.builder_data = input.builderData;
  if (input.published !== undefined) body.published = input.published;

  const envelope = await apiPatch<ApiEnvelope<CampaignLandingPage>>(
    `/sms/campaigns/${campaignId}/landing-page`,
    body
  );
  return envelope.data;
}
