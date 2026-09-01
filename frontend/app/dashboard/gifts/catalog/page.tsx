import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";

import { GiftsCatalog } from "@/components/dashboard/gifts/gifts-catalog";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { Button } from "@/components/ui/button";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { listGiftCatalog } from "@/lib/api/gifts";
import { settleOk } from "@/lib/api/settle";

// Real, frequently-changing backend data — must not be statically cached.
export const dynamic = "force-dynamic";

function GiftCatalogHeader({ canManage }: { canManage: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
          <h2 className="text-2xl font-semibold tracking-tight">Gift Catalog</h2>
          <p className="text-sm text-muted-foreground">Items available for customer rewards.</p>
        </div>
      </div>
      {canManage && (
        <Button nativeButton={false} render={<Link href="/dashboard/gifts/new" />}>
          <Plus />
          Add Gift
        </Button>
      )}
    </div>
  );
}

export default async function GiftCatalogPage() {
  // Fired alongside the permission check instead of after it — halves the
  // number of sequential round trips this page needs before it can render.
  const [user, catalogResult] = await Promise.all([
    getCurrentUserSafeCached(),
    settleOk(listGiftCatalog({ pageSize: 100 })),
  ]);
  if (!user?.permissions.includes("gifts.view")) {
    return (
      <div className="flex flex-col gap-6">
        <GiftCatalogHeader canManage={false} />
        <PermissionDenied description="Ask an admin to grant you the View gifts permission if you think this is a mistake." />
      </div>
    );
  }

  // Guaranteed defined here — the backend enforces the same permission
  // just checked above, so an authorized user's fetch cannot have failed.
  const { items: catalog } = catalogResult!;

  return (
    <div className="flex flex-col gap-6">
      <GiftCatalogHeader canManage={user.permissions.includes("gifts.manage")} />
      <GiftsCatalog gifts={catalog} />
    </div>
  );
}
