"use client";

import { AddGiftDialog } from "@/components/dashboard/gifts/add-gift-dialog";
import { usePermissions } from "@/components/providers/permissions-provider";

export function GiftsPageHeader() {
  const { hasPermission } = usePermissions();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Gifts</h2>
        <p className="text-sm text-muted-foreground">
          Manage the gift catalog and track redemption orders.
        </p>
      </div>
      {hasPermission("gifts.manage") && <AddGiftDialog />}
    </div>
  );
}
