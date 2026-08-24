import Link from "next/link";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ImportsPageHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Imports</h2>
        <p className="text-sm text-muted-foreground">
          Bulk-add customers from a CSV file and track past imports.
        </p>
      </div>
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href="/dashboard/customers" />}
      >
        <Users />
        View Customers
      </Button>
    </div>
  );
}
