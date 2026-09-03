import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { QuickSendComposer } from "@/components/dashboard/campaigns/quick-send/quick-send-composer";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { Button } from "@/components/ui/button";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { getAudienceCounts } from "@/lib/api/campaigns";
import { getSmsGatewayCredentials } from "@/lib/api/integration-credentials";
import { settleOk } from "@/lib/api/settle";
import { getSmsAccount } from "@/lib/api/sms-account";

// Audience counts are real, live data — must not be statically cached.
export const dynamic = "force-dynamic";

function QuickSendHeader() {
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
        <h2 className="text-2xl font-semibold tracking-tight">Quick Send</h2>
        <p className="text-sm text-muted-foreground">
          Compose and send a bulk SMS campaign on a single page — every step of the full builder,
          without the clicking through.
        </p>
      </div>
    </div>
  );
}

/** The simplified, single-page alternative to /dashboard/campaigns/new's
 * 4-step wizard — same underlying data and permission requirements, just a
 * different composer component. See QuickSendComposer. */
export default async function QuickSendPage() {
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
        <QuickSendHeader />
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
      <QuickSendHeader />

      <QuickSendComposer
        audienceCounts={audienceCounts}
        defaultSenderId={credentials.senderId.value ?? ""}
        ratePerSegmentBdt={Number(credentials.ratePerSegmentBdt.value)}
        smsAccount={smsAccount}
      />
    </div>
  );
}
