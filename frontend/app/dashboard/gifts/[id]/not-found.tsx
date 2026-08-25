import { ArrowLeft, Gift } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function GiftNotFound() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={<Link href="/dashboard/gifts" aria-label="Back to gifts" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-2xl font-semibold tracking-tight">Gift</h2>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
        <Gift className="size-10 text-muted-foreground" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">Gift not found</p>
          <p className="text-sm text-muted-foreground">
            It may have been deleted, or the link is incorrect.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/gifts" />}
        >
          Back to Gifts
        </Button>
      </div>
    </div>
  );
}
