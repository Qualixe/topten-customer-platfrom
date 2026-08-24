import Link from "next/link";
import { Megaphone } from "lucide-react";

import { Button } from "@/components/ui/button";

export function NotificationsPageHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Notifications
        </h2>
        <p className="text-sm text-muted-foreground">
          Review SMS, email, and WhatsApp messages sent to customers.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/dashboard/campaigns" />}>
        <Megaphone />
        New Campaign
      </Button>
    </div>
  );
}
