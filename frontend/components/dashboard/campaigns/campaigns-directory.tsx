"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { CampaignsTable } from "@/components/dashboard/campaigns/campaigns-table";
import {
  CampaignsToolbar,
  type StatusFilter,
} from "@/components/dashboard/campaigns/campaigns-toolbar";
import { ExportCampaignsButton } from "@/components/dashboard/campaigns/export-campaigns-button";
import { Button } from "@/components/ui/button";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const selectedCampaigns = useMemo(
    () => filteredCampaigns.filter((campaign) => selectedIds.has(campaign.id)),
    [filteredCampaigns, selectedIds]
  );

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(filteredCampaigns.map((c) => c.id)) : new Set());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Campaigns</CardTitle>
        <CardDescription>
          Every SMS campaign, scheduled, sent, or still in draft
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {selectedIds.size > 0 ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear selection"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="size-4" />
            </Button>
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <div className="ml-auto">
              <ExportCampaignsButton campaigns={selectedCampaigns} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <CampaignsToolbar
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />
            </div>
            <ExportCampaignsButton campaigns={filteredCampaigns} />
          </div>
        )}

        <CampaignsTable
          campaigns={filteredCampaigns}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      </CardContent>
    </Card>
  );
}
