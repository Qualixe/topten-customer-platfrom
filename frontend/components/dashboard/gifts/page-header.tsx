"use client";

import Link from "next/link";
import { Gift, Plus } from "lucide-react";

import { usePermissions } from "@/components/providers/permissions-provider";
import { Button } from "@/components/ui/button";

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
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/dashboard/gifts/catalog" />}
        >
          <Gift />
          View Catalog
        </Button>
        {hasPermission("gifts.manage") && (
          <Button nativeButton={false} render={<Link href="/dashboard/gifts/new" />}>
            <Plus />
            Add Gift
          </Button>
        )}
      </div>
    </div>
  );
}
