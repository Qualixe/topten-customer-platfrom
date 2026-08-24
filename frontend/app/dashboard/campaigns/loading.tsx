import { CampaignsPageHeader } from "@/components/dashboard/campaigns/page-header";
import { CampaignsTableSkeleton } from "@/components/dashboard/campaigns/campaigns-table-skeleton";
import { SmsBalanceCardSkeleton } from "@/components/dashboard/campaigns/sms-balance-card-skeleton";
import { StatsGridSkeleton } from "@/components/dashboard/stats-grid-skeleton";

export default function CampaignsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <CampaignsPageHeader />
      <div className="grid gap-4 lg:grid-cols-2">
        <SmsBalanceCardSkeleton />
      </div>
      <StatsGridSkeleton count={5} />
      <CampaignsTableSkeleton />
    </div>
  );
}
