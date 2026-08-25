import { AlertTriangle, CheckCircle2, Clock, Megaphone, Send } from "lucide-react";

import { CampaignsDirectory } from "@/components/dashboard/campaigns/campaigns-directory";
import { CampaignsPageHeader } from "@/components/dashboard/campaigns/page-header";
import { SmsBalanceCard } from "@/components/dashboard/campaigns/sms-balance-card";
import { StatsGrid, type StatDefinition } from "@/components/dashboard/stats-grid";
import { getCampaignStats, listCampaigns } from "@/lib/api/campaigns";
import { getSmsAccount } from "@/lib/api/sms-account";

// Real, frequently-changing backend data — must not be statically cached.
export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const [{ items: campaigns }, stats, smsAccount] = await Promise.all([
    listCampaigns({ pageSize: 50 }),
    getCampaignStats(),
    getSmsAccount(),
  ]);

  const statDefinitions: StatDefinition[] = [
    {
      key: "total",
      label: "Total Campaigns",
      value: stats.total,
      caption: "Across every status",
      icon: Megaphone,
    },
    {
      key: "scheduled",
      label: "Scheduled",
      value: stats.scheduled,
      caption: "Queued to send",
      icon: Clock,
    },
    {
      key: "processing",
      label: "Processing",
      value: stats.processing,
      caption: "In progress now",
      icon: Send,
      trend: stats.processing > 0 ? "up" : "neutral",
    },
    {
      key: "completed",
      label: "Completed",
      value: stats.completed,
      caption: "Successfully delivered",
      icon: CheckCircle2,
      trend: "up",
    },
    {
      key: "failed",
      label: "Failed",
      value: stats.failed,
      caption: stats.failed > 0 ? "Needs attention" : "None failed",
      icon: AlertTriangle,
      trend: stats.failed > 0 ? "down" : "neutral",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <CampaignsPageHeader />
      <div className="grid gap-4 lg:grid-cols-2">
        <SmsBalanceCard account={smsAccount} />
      </div>
      <StatsGrid stats={statDefinitions} columns={5} />
      <CampaignsDirectory campaigns={campaigns} />
    </div>
  );
}
