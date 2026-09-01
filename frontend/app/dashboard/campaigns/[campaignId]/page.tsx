import { ArrowLeft, Clock, LayoutTemplate, Send, ShieldCheck, TrendingUp, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CampaignStatusBadge } from "@/components/dashboard/campaigns/campaign-status-badge";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { StatsGrid, type StatDefinition } from "@/components/dashboard/stats-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { getCampaign, getCampaignRecipientStats } from "@/lib/api/campaigns";
import { settleOk } from "@/lib/api/settle";
import { ApiError } from "@/lib/api/types";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  // Fired alongside the permission check instead of after it — halves the
  // number of sequential round trips this page needs before it can render.
  // The 404 case is carried through as a sentinel rather than left to
  // reject, so Promise.all doesn't also discard the other two results.
  const NOT_FOUND = "__not_found__" as const;
  const [user, campaignResult, statsResult] = await Promise.all([
    getCurrentUserSafeCached(),
    getCampaign(campaignId).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return NOT_FOUND;
      throw err;
    }),
    settleOk(getCampaignRecipientStats(campaignId)),
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
  const stats = statsResult!;
  const canManage = user.permissions.includes("campaigns.manage");

  const statDefinitions: StatDefinition[] = [
    { key: "recipients", label: "Recipients", value: stats.total, icon: Users },
    { key: "sent", label: "Sent", value: stats.sent, icon: Send },
    { key: "delivered", label: "Delivered", value: stats.delivered, icon: ShieldCheck },
    { key: "failed", label: "Failed", value: stats.failed, icon: XCircle },
    { key: "verified", label: "Verified", value: stats.verified, icon: ShieldCheck },
    {
      key: "pending-verification",
      label: "Pending Verification",
      value: stats.pendingVerification,
      icon: Clock,
    },
    {
      key: "verification-rate",
      label: "Verification Rate",
      value: `${stats.verificationRate}%`,
      caption: "Verified out of all recipients",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">{campaign.name}</h2>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {campaign.channel === "EMAIL"
                ? `Subject: ${campaign.subject}`
                : `Sender ID: ${campaign.senderId}`}
            </p>
          </div>
        </div>
        {canManage && (
          <Button
            nativeButton={false}
            render={<Link href={`/dashboard/campaigns/${campaignId}/builder`} />}
          >
            <LayoutTemplate className="size-4" />
            Landing Page Builder
          </Button>
        )}
      </div>

      <StatsGrid stats={statDefinitions} />

      <Card>
        <CardHeader>
          <CardTitle>Message</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{campaign.message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
