"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function VerifiedCustomersCampaignFilter({
  campaigns,
}: {
  campaigns: { id: string; name: string }[];
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

  return (
    <Select value={selected} onValueChange={(value) => handleChange(value ?? "all")}>
      <SelectTrigger className="w-full sm:w-56" aria-label="Filter by campaign">
        <SelectValue>
          {(value: string) =>
            value === "all"
              ? "All Campaigns"
              : (campaigns.find((campaign) => campaign.id === value)?.name ?? "All Campaigns")
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Campaigns</SelectItem>
        {campaigns.map((campaign) => (
          <SelectItem key={campaign.id} value={campaign.id}>
            {campaign.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
