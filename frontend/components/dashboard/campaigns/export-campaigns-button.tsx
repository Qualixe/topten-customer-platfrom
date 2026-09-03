"use client";

import { Download } from "lucide-react";

import {
  exportCampaignsCsv,
  useCustomerTypeNames,
} from "@/components/dashboard/campaigns/campaign-export";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SmsCampaign } from "@/lib/api/campaigns";

/** Export button for the Campaigns list page — exports whatever's
 * currently on screen (respecting the search/status filter, same as
 * `campaigns` here already does), split by channel like the Reports page's
 * Campaign History export. */
export function ExportCampaignsButton({ campaigns }: { campaigns: SmsCampaign[] }) {
  const hasEmail = campaigns.some((c) => c.channel === "EMAIL");
  const typeNames = useCustomerTypeNames();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" disabled={campaigns.length === 0} />}>
        <Download className="size-4" aria-hidden="true" />
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
  );
}
