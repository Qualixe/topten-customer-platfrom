import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GiftDetailView } from "@/components/dashboard/gifts/gift-detail-view";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { Button } from "@/components/ui/button";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { getGiftCatalogItem, listGiftCategories, listGiftOrders } from "@/lib/api/gifts";
import { settleOk } from "@/lib/api/settle";
import { ApiError } from "@/lib/api/types";

export const dynamic = "force-dynamic";

function GiftDetailHeader({ name }: { name?: string }) {
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
        <h2 className="text-2xl font-semibold tracking-tight">{name ?? "Gift"}</h2>
        <p className="text-sm text-muted-foreground">Manage this gift&apos;s catalog details.</p>
      </div>
    </div>
  );
}

export default async function GiftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fired alongside the permission check instead of after it — halves the
  // number of sequential round trips this page needs before it can render.
  // The 404 case is carried through as a sentinel rather than left to
  // reject, so Promise.all doesn't also discard the other results.
  const NOT_FOUND = "__not_found__" as const;
  const [user, giftResult, ordersResult, categoriesResult] = await Promise.all([
    getCurrentUserSafeCached(),
    getGiftCatalogItem(id).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return NOT_FOUND;
      throw err;
    }),
    settleOk(listGiftOrders({ catalogItemId: id, pageSize: 50 })),
    settleOk(listGiftCategories()),
  ]);
  if (!user?.permissions.includes("gifts.view")) {
    return (
      <div className="flex flex-col gap-6">
        <GiftDetailHeader />
        <PermissionDenied description="Ask an admin to grant you the View gifts permission if you think this is a mistake." />
      </div>
    );
  }

  if (giftResult === NOT_FOUND) notFound();
  const gift = giftResult;
  // Guaranteed defined here — the backend enforces the same permission
  // just checked above, so an authorized user's fetches cannot have failed.
  const { items: orders } = ordersResult!;
  const categories = categoriesResult!;
  const canManage = user.permissions.includes("gifts.manage");

  return (
    <div className="flex flex-col gap-6">
      <GiftDetailHeader name={gift.name} />
      <GiftDetailView gift={gift} orders={orders} categories={categories} canManage={canManage} />
    </div>
  );
}
