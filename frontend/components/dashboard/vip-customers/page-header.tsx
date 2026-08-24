import Link from "next/link";
import { Gift } from "lucide-react";

import { Button } from "@/components/ui/button";

export function VipCustomersPageHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          VIP Customers
        </h2>
        <p className="text-sm text-muted-foreground">
          Your highest-value customers, ranked by spend.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/dashboard/gifts" />}>
        <Gift />
        Send VIP Gift
      </Button>
    </div>
  );
}
