"use client";

import { Download, Megaphone } from "lucide-react";

import { CampaignStatusBadge } from "@/components/dashboard/campaigns/campaign-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildCsv, downloadCsvFile } from "@/lib/csv";
import {
  CAMPAIGN_TYPE_LABELS,
  type AudienceRuleType,
  type CampaignChannel,
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

const CSV_HEADERS = [
  "Campaign",
  "Channel",
  "Type",
  "Audience",
  "Recipients",
  "SMS Segments",
  "Status",
  "Sender ID",
  "Subject",
  "Date",
  "Cost",
];

function campaignToCsvRow(campaign: SmsCampaign): (string | number)[] {
  const date = dateCell(campaign);
  return [
    campaign.name,
    campaign.channel === "EMAIL" ? "Email" : "SMS",
    CAMPAIGN_TYPE_LABELS[campaign.campaignType],
    describeAudience(campaign),
    campaign.recipientsResolvedAt ? campaign.totalRecipients : "Resolving",
    campaign.channel === "EMAIL" ? "" : campaign.smsSegments,
    campaign.status,
    campaign.senderId ?? "",
    campaign.subject ?? "",
    `${date.label}: ${date.value}`,
    campaign.estimatedCost,
  ];
}

function exportCampaigns(campaigns: SmsCampaign[], channel: CampaignChannel | "all") {
  const filtered = channel === "all" ? campaigns : campaigns.filter((c) => c.channel === channel);
  const csv = buildCsv(CSV_HEADERS, filtered.map(campaignToCsvRow));
  const suffix = channel === "all" ? "all" : channel.toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  downloadCsvFile(`campaign-history-${suffix}-${today}.csv`, csv);
}

/** Recent campaign activity for the Reports page, with a channel-aware CSV
 * export — the export button lets an admin pull the whole history, or just
 * the SMS or Email rows, without leaving this page. Built from the same
 * campaign list the Campaigns page itself uses (see lib/api/campaigns.ts),
 * exported client-side since the data driving this table is already loaded. */
export function CampaignHistory({ campaigns }: { campaigns: SmsCampaign[] }) {
  const hasEmail = campaigns.some((c) => c.channel === "EMAIL");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign History</CardTitle>
        <CardDescription>Every SMS and email campaign sent from this platform.</CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={campaigns.length === 0} />}>
              <Download className="size-3.5" aria-hidden="true" />
              Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportCampaigns(campaigns, "all")}>
                All channels
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportCampaigns(campaigns, "SMS")}>
                SMS only
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!hasEmail} onClick={() => exportCampaigns(campaigns, "EMAIL")}>
                Email only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Campaign history will show up here once you send one."
          />
        ) : (
          <div className="rounded-lg border">
            <div className="max-h-[480px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => {
                    const date = dateCell(campaign);
                    return (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <p className="max-w-56 truncate text-sm font-medium">{campaign.name}</p>
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
        )}
      </CardContent>
    </Card>
  );
}
