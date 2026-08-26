import { Builder } from "@/components/campaign-builder/Builder";

export default async function CampaignBuilderPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  return <Builder campaignId={campaignId} />;
}
