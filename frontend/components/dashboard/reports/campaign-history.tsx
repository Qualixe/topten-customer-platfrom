"use client";

import { useMemo, useState } from "react";
import { Megaphone, X } from "lucide-react";

import { CampaignStatusBadge } from "@/components/dashboard/campaigns/campaign-status-badge";
import {
  campaignDateCell,
  describeAudience,
  useCustomerTypeNames,
} from "@/components/dashboard/campaigns/campaign-export";
import { ExportCampaignsButton } from "@/components/dashboard/campaigns/export-campaigns-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CAMPAIGN_TYPE_LABELS, type SmsCampaign } from "@/lib/api/campaigns";
import { formatCurrency } from "@/lib/api/sms-account";

/** Recent campaign activity for the Reports page, with a channel-aware CSV
 * export — the export button lets an admin pull the whole history, or just
 * the SMS or Email rows, without leaving this page. Built from the same
 * campaign list the Campaigns page itself uses (see lib/api/campaigns.ts).
 * Row checkboxes mirror the Campaigns list page's select-then-export
 * pattern — see CampaignsDirectory/CampaignsTable. */
export function CampaignHistory({ campaigns }: { campaigns: SmsCampaign[] }) {
  const typeNames = useCustomerTypeNames();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedCampaigns = useMemo(
    () => campaigns.filter((campaign) => selectedIds.has(campaign.id)),
    [campaigns, selectedIds]
  );
  const allSelected = campaigns.length > 0 && campaigns.every((c) => selectedIds.has(c.id));
  const someSelected = !allSelected && campaigns.some((c) => selectedIds.has(c.id));

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(campaigns.map((c) => c.id)) : new Set());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign History</CardTitle>
        <CardDescription>Every SMS and email campaign sent from this platform.</CardDescription>
        <CardAction>
          {selectedIds.size > 0 ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Clear selection"
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="size-4" />
              </Button>
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <ExportCampaignsButton campaigns={selectedCampaigns} size="sm" />
            </div>
          ) : (
            <ExportCampaignsButton campaigns={campaigns} size="sm" />
          )}
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
                    <TableHead className="w-8">
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                        aria-label="Select all campaigns"
                      />
                    </TableHead>
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
                    const isSelected = selectedIds.has(campaign.id);
                    return (
                      <TableRow key={campaign.id} data-state={isSelected ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              toggleSelect(campaign.id, checked === true)
                            }
                            aria-label={`Select ${campaign.name}`}
                          />
                        </TableCell>
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
