import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SimpleSendComposer } from "@/components/dashboard/campaigns/simple-send/simple-send-composer";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { Button } from "@/components/ui/button";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { getAudienceCounts, getCampaign } from "@/lib/api/campaigns";
import { getSmsGatewayCredentials } from "@/lib/api/integration-credentials";
import { settleOk } from "@/lib/api/settle";
import { getSmsAccount } from "@/lib/api/sms-account";
import { ApiError } from "@/lib/api/types";

export const dynamic = "force-dynamic";

function EditCampaignHeader({ backHref }: { backHref: string }) {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon-sm"
        nativeButton={false}
        render={<Link href={backHref} aria-label="Back to campaign" />}
      >
        <ArrowLeft className="size-4" />
      </Button>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Edit Campaign</h2>
        <p className="text-sm text-muted-foreground">
          Update the details, message, and schedule for this campaign.
        </p>
      </div>
    </div>
  );
}

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const backHref = `/dashboard/campaigns/${campaignId}`;

  const NOT_FOUND = "__not_found__" as const;
  const [user, campaignResult, audienceCountsResult, credentialsResult, smsAccountResult] =
    await Promise.all([
      getCurrentUserSafeCached(),
      getCampaign(campaignId).catch((err) => {
        if (err instanceof ApiError && err.status === 404) return NOT_FOUND;
        throw err;
      }),
      settleOk(getAudienceCounts()),
      settleOk(getSmsGatewayCredentials()),
      settleOk(getSmsAccount()),
    ]);

  if (!user?.permissions.includes("campaigns.manage")) {
    return (
      <div className="flex flex-col gap-6">
        <EditCampaignHeader backHref={backHref} />
        <PermissionDenied description="Ask an admin to grant you the Manage SMS campaigns permission if you think this is a mistake." />
      </div>
    );
  }

  if (campaignResult === NOT_FOUND) notFound();
  const campaign = campaignResult;

  // Once a campaign is out of DRAFT/SCHEDULED it's already sending or done
  // — its recipient snapshot has been acted on, so nothing here is safe to
  // change anymore.
  if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
    return (
      <div className="flex flex-col gap-6">
        <EditCampaignHeader backHref={backHref} />
        <PermissionDenied
          title="This campaign can no longer be edited"
          description="Only draft or scheduled campaigns can be edited — this one has already started sending or finished."
        />
      </div>
    );
  }

  // Guaranteed defined here — the backend enforces the same permission
  // just checked above, so an authorized user's fetches cannot have failed.
  const audienceCounts = audienceCountsResult!;
  const credentials = credentialsResult!;
  const smsAccount = smsAccountResult!;

  return (
    <SimpleSendComposer
      audienceCounts={audienceCounts}
      defaultSenderId={credentials.senderId.value ?? ""}
      ratePerSegmentBdt={Number(credentials.ratePerSegmentBdt.value)}
      smsAccount={smsAccount}
      editCampaign={campaign}
    />
  );
}
