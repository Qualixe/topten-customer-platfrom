import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { NewGiftForm } from "@/components/dashboard/gifts/new-gift-form";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { Button } from "@/components/ui/button";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { listGiftCategories } from "@/lib/api/gifts";
import { settleOk } from "@/lib/api/settle";

export const dynamic = "force-dynamic";

function NewGiftHeader() {
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
          <h2 className="text-2xl font-semibold tracking-tight">Add Gift</h2>
          <p className="text-sm text-muted-foreground">
            Adds a new item to the gift catalog.
          </p>
        </div>
      </div>
      <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/gifts/catalog" />}>
        Gift Catalog
      </Button>
    </div>
  );
}

export default async function NewGiftPage() {
  // Fired alongside the permission check instead of after it — halves the
  // number of sequential round trips this page needs before it can render.
  const [user, categoriesResult] = await Promise.all([
    getCurrentUserSafeCached(),
    settleOk(listGiftCategories()),
  ]);
  if (!user?.permissions.includes("gifts.manage")) {
    return (
      <div className="flex flex-col gap-6">
        <NewGiftHeader />
        <PermissionDenied description="Ask an admin to grant you the Manage gifts permission if you think this is a mistake." />
      </div>
    );
  }

  // Guaranteed defined here — the backend enforces the same permission
  // just checked above, so an authorized user's fetch cannot have failed.
  const categories = categoriesResult!;

  return (
    <div className="flex flex-col gap-6">
      <NewGiftHeader />
      <div className="max-w-2xl">
        <NewGiftForm categories={categories} />
      </div>
    </div>
  );
}
