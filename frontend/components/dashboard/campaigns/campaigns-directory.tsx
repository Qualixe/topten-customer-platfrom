"use client";

import { useMemo, useState } from "react";

import { CampaignsTable } from "@/components/dashboard/campaigns/campaigns-table";
import {
  CampaignsToolbar,
  type StatusFilter,
} from "@/components/dashboard/campaigns/campaigns-toolbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SmsCampaign } from "@/lib/api/campaigns";

export function CampaignsDirectory({ campaigns }: { campaigns: SmsCampaign[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLowerCase();

    return campaigns.filter((campaign) => {
      const matchesQuery =
        query.length === 0 || campaign.name.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" || campaign.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [campaigns, search, statusFilter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Campaigns</CardTitle>
        <CardDescription>
          Every SMS campaign, scheduled, sent, or still in draft
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <CampaignsToolbar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />

        <CampaignsTable campaigns={filteredCampaigns} />
      </CardContent>
    </Card>
  );
}
