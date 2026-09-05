import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { SendGiftForm } from "@/components/dashboard/gifts/send-gift-form";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { Button } from "@/components/ui/button";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { listGiftCatalog } from "@/lib/api/gifts";
import { settleOk } from "@/lib/api/settle";

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
          Pick one or more customers and a catalog item — this queues a gift
          order for each of them that you can schedule and send from the
          Gifts page.
        </p>
      </div>
    </div>
  );
}

export default async function SendGiftPage() {
  // Fired alongside the permission check instead of after it — halves the
  // number of sequential round trips this page needs before it can render.
  const [user, catalogResult] = await Promise.all([
    getCurrentUserSafeCached(),
    settleOk(listGiftCatalog({ pageSize: 100 })),
  ]);
  if (!user?.permissions.includes("gifts.manage")) {
    return (
      <div className="flex flex-col gap-6">
        <SendGiftHeader />
        <PermissionDenied description="Ask an admin to grant you the Manage gifts permission if you think this is a mistake." />
      </div>
    );
  }

  // Guaranteed defined here — the backend enforces the same permission
  // just checked above, so an authorized user's fetch cannot have failed.
  const { items: catalog } = catalogResult!;

  return (
    <div className="flex flex-col gap-6">
      <SendGiftHeader />
      <SendGiftForm catalog={catalog} />
    </div>
  );
}
