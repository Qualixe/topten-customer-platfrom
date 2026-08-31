import { Megaphone } from "lucide-react";

import { CampaignStatusBadge } from "@/components/dashboard/campaigns/campaign-status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CAMPAIGN_TYPE_LABELS,
  type AudienceRuleType,
  type CampaignType,
  type SmsCampaign,
} from "@/lib/api/campaigns";
import { formatCurrency } from "@/lib/api/sms-account";

const AUDIENCE_LABELS: Record<AudienceRuleType, string> = {
  GENERAL: "General",
  VIP: "VIP",
  VVIP: "VVIP",
  MISSING_DOB: "Missing DOB",
  MISSING_ADDRESS: "Missing Address",
  MISSING_DOB_AND_ADDRESS: "Missing DOB & Address",
  NEW_SINCE_DATE: "New since",
  NEVER_RECEIVED_TYPE: "Never received",
  RECEIVED_TYPE_BEFORE_DATE: "Received before",
  SPECIFIC_CUSTOMERS: "Specific customers",
  NEVER_VERIFIED: "Never verified",
  TARGETED_NOT_VERIFIED: "Targeted, not verified",
};

function describeAudience(campaign: SmsCampaign): string {
  const base = AUDIENCE_LABELS[campaign.audienceRuleType];
  const params = campaign.audienceRuleParams;

  if (campaign.audienceRuleType === "NEW_SINCE_DATE" && params.sinceDate) {
    return `${base} ${params.sinceDate}`;
  }
  if (campaign.audienceRuleType === "NEVER_RECEIVED_TYPE" && params.campaignType) {
    return `${base} ${CAMPAIGN_TYPE_LABELS[params.campaignType as CampaignType] ?? params.campaignType}`;
  }
  if (campaign.audienceRuleType === "RECEIVED_TYPE_BEFORE_DATE" && params.campaignType) {
    const typeLabel = CAMPAIGN_TYPE_LABELS[params.campaignType as CampaignType] ?? params.campaignType;
    return `${base} ${typeLabel} (${params.beforeDate})`;
  }
  return base;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  });
}

function dateCell(campaign: SmsCampaign) {
  if (campaign.scheduledAt) {
    return { label: "Scheduled", value: formatDateTime(campaign.scheduledAt) };
  }
  return { label: "Created", value: formatDateTime(campaign.createdAt) };
}

export function CampaignsTable({ campaigns }: { campaigns: SmsCampaign[] }) {
  return (
    <div className="rounded-lg border">
      <div className="max-h-[560px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>SMS Count</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="p-0">
                  <EmptyState
                    icon={Megaphone}
                    title="No campaigns found"
                    description="Try adjusting your search or status filter."
                  />
                </TableCell>
              </TableRow>
            )}
            {campaigns.map((campaign) => {
              const date = dateCell(campaign);

              return (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {campaign.name}
                      </p>
                      <p className="max-w-xs truncate text-xs text-muted-foreground">
                        {campaign.message}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={campaign.channel === "EMAIL" ? "default" : "secondary"}>
                      {campaign.channel === "EMAIL" ? "Email" : "SMS"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {CAMPAIGN_TYPE_LABELS[campaign.campaignType]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {describeAudience(campaign)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {campaign.recipientsResolvedAt
                      ? campaign.totalRecipients.toLocaleString("en-US")
                      : "Resolving…"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {campaign.channel === "EMAIL" ? "—" : `${campaign.smsSegments} SMS`}
                  </TableCell>
                  <TableCell>
                    <CampaignStatusBadge status={campaign.status} />
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{date.value}</p>
                    <p className="text-xs text-muted-foreground">{date.label}</p>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(campaign.estimatedCost)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
