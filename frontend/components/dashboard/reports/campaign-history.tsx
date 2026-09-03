"use client";

import { Download, Megaphone } from "lucide-react";

import { CampaignStatusBadge } from "@/components/dashboard/campaigns/campaign-status-badge";
import {
  campaignDateCell,
  describeAudience,
  exportCampaignsCsv,
  useCustomerTypeNames,
} from "@/components/dashboard/campaigns/campaign-export";
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
import { CAMPAIGN_TYPE_LABELS, type SmsCampaign } from "@/lib/api/campaigns";
import { formatCurrency } from "@/lib/api/sms-account";

/** Recent campaign activity for the Reports page, with a channel-aware CSV
 * export — the export button lets an admin pull the whole history, or just
 * the SMS or Email rows, without leaving this page. Built from the same
 * campaign list the Campaigns page itself uses (see lib/api/campaigns.ts). */
export function CampaignHistory({ campaigns }: { campaigns: SmsCampaign[] }) {
  const hasEmail = campaigns.some((c) => c.channel === "EMAIL");
  const typeNames = useCustomerTypeNames();

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
              <DropdownMenuItem onClick={() => exportCampaignsCsv(campaigns, "all", typeNames)}>
                All channels
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportCampaignsCsv(campaigns, "SMS", typeNames)}>
                SMS only
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasEmail}
                onClick={() => exportCampaignsCsv(campaigns, "EMAIL", typeNames)}
              >
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
                    const date = campaignDateCell(campaign);
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
                          {describeAudience(campaign, typeNames)}
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
