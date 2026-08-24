import Link from "next/link";
import { Gift } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BirthdaysPageHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Birthdays</h2>
        <p className="text-sm text-muted-foreground">
          Keep track of customer birthdays and plan gifts ahead of time.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/dashboard/gifts" />}>
        <Gift />
        Manage Gifts
      </Button>
    </div>
  );
}
