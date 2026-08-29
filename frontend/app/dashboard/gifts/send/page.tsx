import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { SendGiftForm } from "@/components/dashboard/gifts/send-gift-form";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { Button } from "@/components/ui/button";
import { getCurrentUserSafe } from "@/lib/api/auth";
import { listGiftCatalog } from "@/lib/api/gifts";

export const dynamic = "force-dynamic";

function SendGiftHeader() {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon-sm"
        nativeButton={false}
        render={<Link href="/dashboard/gifts" aria-label="Back to gifts" />}
      >
        <ArrowLeft className="size-4" />
      </Button>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Send Gift</h2>
        <p className="text-sm text-muted-foreground">
          Pick a customer and a catalog item — this queues a gift order you
          can schedule and send from the Gifts page.
        </p>
      </div>
    </div>
  );
}

export default async function SendGiftPage() {
  const user = await getCurrentUserSafe();
  if (!user?.permissions.includes("gifts.manage")) {
    return (
      <div className="flex flex-col gap-6">
        <SendGiftHeader />
        <PermissionDenied description="Ask an admin to grant you the Manage gifts permission if you think this is a mistake." />
      </div>
    );
  }

  const { items: catalog } = await listGiftCatalog({ pageSize: 100 });

  return (
    <div className="flex flex-col gap-6">
      <SendGiftHeader />
      <div className="max-w-2xl">
        <SendGiftForm catalog={catalog} />
      </div>
    </div>
  );
}
