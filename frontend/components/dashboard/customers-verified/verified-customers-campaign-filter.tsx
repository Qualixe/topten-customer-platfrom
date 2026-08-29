"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CampaignFilterOption {
  id: string;
  name: string;
  /** ISO date — shown next to the name so campaigns that share a name
   * (e.g. several "Eid campaign" runs) are still distinguishable. */
  date: string;
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function VerifiedCustomersCampaignFilter({
  campaigns,
}: {
  campaigns: CampaignFilterOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("campaignId") ?? "all";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set("campaignId", value);
    else params.delete("campaignId");
    params.delete("page");
    router.push(`/dashboard/customers/verified?${params.toString()}`);
  }

  function label(campaign: CampaignFilterOption): string {
    const date = formatShortDate(campaign.date);
    return date ? `${campaign.name} — ${date}` : campaign.name;
  }

  function labelForId(id: string): string {
    const campaign = campaigns.find((c) => c.id === id);
    return campaign ? label(campaign) : "All Campaigns";
  }

  return (
    <Select value={selected} onValueChange={(value) => handleChange(value ?? "all")}>
      <SelectTrigger className="w-full sm:w-56" aria-label="Filter by campaign">
        <SelectValue>{(value: string) => (value === "all" ? "All Campaigns" : labelForId(value))}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Campaigns</SelectItem>
        {campaigns.map((campaign) => (
          <SelectItem key={campaign.id} value={campaign.id}>
            {label(campaign)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
