import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CampaignsPageHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Campaigns</h2>
        <p className="text-sm text-muted-foreground">
          Send and track bulk SMS campaigns to your customers.
        </p>
      </div>
      <Button
        nativeButton={false}
        render={<Link href="/dashboard/campaigns/new" />}
      >
        <Plus />
        New Campaign
      </Button>
    </div>
  );
}
