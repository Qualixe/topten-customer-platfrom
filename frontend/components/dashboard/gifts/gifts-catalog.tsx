"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";

import {
  GiftsToolbar,
  type CategoryFilter,
  type StockFilter,
} from "@/components/dashboard/gifts/gifts-toolbar";
import { GiftsGrid } from "@/components/dashboard/gifts/gifts-grid";
import { usePermissions } from "@/components/providers/permissions-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deleteGiftCatalogItem, type GiftCategoryOption, type GiftItem } from "@/lib/api/gifts";
import { getErrorMessage } from "@/lib/api/types";

export function GiftsCatalog({ gifts }: { gifts: GiftItem[] }) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("gifts.manage");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const categories = useMemo(() => {
    const byId = new Map<string, GiftCategoryOption>();
    for (const gift of gifts) byId.set(gift.category.id, gift.category);
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [gifts]);

  const filteredGifts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return gifts.filter((gift) => {
      const matchesQuery =
        query.length === 0 || gift.name.toLowerCase().includes(query);
      const matchesCategory =
        categoryFilter === "all" || gift.category.id === categoryFilter;
      const matchesStock =
        stockFilter === "all" || gift.stockStatus === stockFilter;

      return matchesQuery && matchesCategory && matchesStock;
    });
  }, [gifts, search, categoryFilter, stockFilter]);

  function handleToggleSelect(gift: GiftItem, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(gift.id);
      else next.delete(gift.id);
      return next;
    });
  }

  function handleToggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(filteredGifts.map((gift) => gift.id)) : new Set());
  }

  async function handleDeleteGift(gift: GiftItem) {
    if (!window.confirm(`Delete "${gift.name}" from the catalog? This can't be undone.`)) return;
    try {
      await deleteGiftCatalogItem(gift.id);
      router.refresh();
    } catch (err) {
      window.alert(getErrorMessage(err, "Unable to delete this gift."));
    }
  }

  async function handleBulkDelete() {
    const count = selectedIds.size;
    if (
      !window.confirm(
        `Delete ${count} gift${count === 1 ? "" : "s"} from the catalog? This can't be undone.`
      )
    ) {
      return;
    }

    setBulkDeleting(true);
    const results = await Promise.allSettled(
      Array.from(selectedIds).map((id) => deleteGiftCatalogItem(id))
    );
    setBulkDeleting(false);

    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed > 0) {
      window.alert(
        `${failed} of ${count} gift${count === 1 ? "" : "s"} couldn't be deleted. Please try again.`
      );
    }

    setSelectedIds(new Set());
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {selectedIds.size > 0 ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear selection"
              onClick={() => setSelectedIds(new Set())}
            >
              <X />
            </Button>
            <p className="text-sm font-medium">
              {selectedIds.size} selected
            </p>
            <Button
              variant="destructive"
              size="sm"
              className="ml-auto"
              disabled={bulkDeleting}
              onClick={handleBulkDelete}
            >
              <Trash2 />
              {bulkDeleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        ) : (
          <GiftsToolbar
            search={search}
            onSearchChange={setSearch}
            categories={categories}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            stockFilter={stockFilter}
            onStockFilterChange={setStockFilter}
          />
        )}

        <GiftsGrid
          gifts={filteredGifts}
          canManage={canManage}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onDeleteGift={handleDeleteGift}
        />
      </CardContent>
    </Card>
  );
}
