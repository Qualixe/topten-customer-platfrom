"use client";

import { Download } from "lucide-react";

import {
  exportCampaignsCsv,
  useCustomerTypeNames,
} from "@/components/dashboard/campaigns/campaign-export";
import { Button } from "@/components/ui/button";
import type { SmsCampaign } from "@/lib/api/campaigns";

/** Export control for campaign data — exports whatever's currently on
 * screen (respecting the search/status filter, same as `campaigns` here
 * already does). Shared by the Campaigns list page and the Reports page's
 * Campaign History card so both use the same control.
 *
 * Previously offered a per-channel (All/SMS-only/Email-only) filter via a
 * Select — removed per request; it always exports every channel now. */
export function ExportCampaignsButton({
  campaigns,
  size = "default",
}: {
  campaigns: SmsCampaign[];
  size?: "default" | "sm";
}) {
  const typeNames = useCustomerTypeNames();

  return (
    <Button
      variant="outline"
      size={size}
      disabled={campaigns.length === 0}
      onClick={() => exportCampaignsCsv(campaigns, "all", typeNames)}
    >
      <Download className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden="true" />
      Export
    </Button>
  );
}
