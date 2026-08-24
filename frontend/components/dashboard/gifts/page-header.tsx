import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function GiftsPageHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Gifts</h2>
        <p className="text-sm text-muted-foreground">
          Manage the gift catalog and track redemption orders.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/dashboard/gifts" />}>
        <Plus />
        Add Gift
      </Button>
    </div>
  );
}
