"use client";

import { Megaphone } from "lucide-react";

import { CampaignStatusBadge } from "@/components/dashboard/campaigns/campaign-status-badge";
import {
  campaignDateCell,
  describeAudience,
  useCustomerTypeNames,
} from "@/components/dashboard/campaigns/campaign-export";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CAMPAIGN_TYPE_LABELS, type SmsCampaign } from "@/lib/api/campaigns";
import { formatCurrency } from "@/lib/api/sms-account";

export function CampaignsTable({
  campaigns,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: {
  campaigns: SmsCampaign[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
}) {
  const typeNames = useCustomerTypeNames();
  const allSelected = campaigns.length > 0 && campaigns.every((c) => selectedIds.has(c.id));
  const someSelected = !allSelected && campaigns.some((c) => selectedIds.has(c.id));

  return (
    <div className="rounded-lg border">
      <div className="max-h-[560px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={(checked) => onToggleSelectAll(checked === true)}
                  disabled={campaigns.length === 0}
                  aria-label="Select all campaigns"
                />
              </TableHead>
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
                <TableCell colSpan={10} className="p-0">
                  <EmptyState
                    icon={Megaphone}
                    title="No campaigns found"
                    description="Try adjusting your search or status filter."
                  />
                </TableCell>
              </TableRow>
            )}
            {campaigns.map((campaign) => {
              const date = campaignDateCell(campaign);
              const isSelected = selectedIds.has(campaign.id);

              return (
                <TableRow key={campaign.id} data-state={isSelected ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => onToggleSelect(campaign.id, checked === true)}
                      aria-label={`Select ${campaign.name}`}
                    />
                  </TableCell>
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
                    {describeAudience(campaign, typeNames)}
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
