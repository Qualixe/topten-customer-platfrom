"use client";

import Link from "next/link";
import { Plus, Zap } from "lucide-react";

import { usePermissions } from "@/components/providers/permissions-provider";
import { Button } from "@/components/ui/button";

export function CampaignsPageHeader() {
  const { hasPermission } = usePermissions();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Campaigns</h2>
        <p className="text-sm text-muted-foreground">
          Send and track bulk SMS campaigns to your customers.
        </p>
      </div>
      {hasPermission("campaigns.manage") && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/dashboard/campaigns/quick-send" />}
          >
            <Zap />
            Quick Send
          </Button>
          <Button nativeButton={false} render={<Link href="/dashboard/campaigns/new" />}>
            <Plus />
            New Campaign
          </Button>
        </div>
      )}
    </div>
  );
}
