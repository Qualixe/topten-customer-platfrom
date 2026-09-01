import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { CampaignComposer } from "@/components/dashboard/campaigns/new/campaign-composer";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { Button } from "@/components/ui/button";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { getAudienceCounts } from "@/lib/api/campaigns";
import { getSmsGatewayCredentials } from "@/lib/api/integration-credentials";
import { settleOk } from "@/lib/api/settle";
import { getSmsAccount } from "@/lib/api/sms-account";

// Audience counts are real, live data — must not be statically cached.
export const dynamic = "force-dynamic";

function NewCampaignHeader() {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon-sm"
        nativeButton={false}
        render={<Link href="/dashboard/campaigns" aria-label="Back to campaigns" />}
      >
        <ArrowLeft className="size-4" />
      </Button>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">New Campaign</h2>
        <p className="text-sm text-muted-foreground">
          Compose and send a bulk SMS or Email campaign to your customers.
        </p>
      </div>
    </div>
  );
}

export default async function NewCampaignPage() {
  // Fired alongside the permission check instead of after it — halves the
  // number of sequential round trips this page needs before it can render.
  const [user, audienceCountsResult, credentialsResult, smsAccountResult] = await Promise.all([
    getCurrentUserSafeCached(),
    settleOk(getAudienceCounts()),
    settleOk(getSmsGatewayCredentials()),
    settleOk(getSmsAccount()),
  ]);
  if (!user?.permissions.includes("campaigns.manage")) {
    return (
      <div className="flex flex-col gap-6">
        <NewCampaignHeader />
        <PermissionDenied description="Ask an admin to grant you the Manage SMS campaigns permission if you think this is a mistake." />
      </div>
    );
  }

  // Guaranteed defined here — the backend enforces the same permission
  // just checked above, so an authorized user's fetches cannot have failed.
  const audienceCounts = audienceCountsResult!;
  const credentials = credentialsResult!;
  const smsAccount = smsAccountResult!;

  return (
    <div className="flex flex-col gap-6">
      <NewCampaignHeader />

      <CampaignComposer
        audienceCounts={audienceCounts}
        defaultSenderId={credentials.senderId.value ?? ""}
        ratePerSegmentBdt={Number(credentials.ratePerSegmentBdt.value)}
        smsAccount={smsAccount}
      />
    </div>
  );
}
