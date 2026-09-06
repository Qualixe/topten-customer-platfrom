import { Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function SegmentsPageHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Segments</h2>
        <p className="text-sm text-muted-foreground">
          Live breakdowns of your audience — use them as campaign targets.
        </p>
      </div>
      {/* "By Customer Type" is the only segment dimension with configurable
       * buckets — new types are managed from Settings, not here, so this
       * just links there instead of duplicating that UI. */}
      <Button nativeButton={false} render={<Link href="/dashboard/settings?tab=customers" />}>
        <Plus className="size-4" />
        Add Segment Type
      </Button>
    </div>
  );
}
