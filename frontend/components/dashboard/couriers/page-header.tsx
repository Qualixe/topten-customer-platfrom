import Link from "next/link";
import { Gift } from "lucide-react";

import { AddDeliveryDialog } from "@/components/dashboard/couriers/add-delivery-dialog";
import { Button } from "@/components/ui/button";

export function CouriersPageHeader({ canManage }: { canManage: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Couriers</h2>
        <p className="text-sm text-muted-foreground">
          Track gift deliveries across every courier partner.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/dashboard/gifts" />}
        >
          <Gift />
          View Gifts
        </Button>
        {canManage && <AddDeliveryDialog />}
      </div>
    </div>
  );
}
