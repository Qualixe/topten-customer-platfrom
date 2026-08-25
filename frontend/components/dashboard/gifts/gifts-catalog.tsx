"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { EditGiftDialog } from "@/components/dashboard/gifts/edit-gift-dialog";
import { GiftDetailsDialog } from "@/components/dashboard/gifts/gift-details-dialog";
import { GiftsGrid } from "@/components/dashboard/gifts/gifts-grid";
import {
  GiftsToolbar,
  type CategoryFilter,
  type StockFilter,
} from "@/components/dashboard/gifts/gifts-toolbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { deleteGiftCatalogItem, type GiftItem } from "@/lib/api/gifts";
import { getErrorMessage } from "@/lib/api/types";

export function GiftsCatalog({ gifts }: { gifts: GiftItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<GiftItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const filteredGifts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return gifts.filter((gift) => {
      const matchesQuery =
        query.length === 0 || gift.name.toLowerCase().includes(query);
      const matchesCategory =
        categoryFilter === "all" || gift.category === categoryFilter;
      const matchesStock =
        stockFilter === "all" || gift.stockStatus === stockFilter;

      return matchesQuery && matchesCategory && matchesStock;
    });
  }, [gifts, search, categoryFilter, stockFilter]);

  function handleViewGift(gift: GiftItem) {
    setSelectedGift(gift);
    setViewDialogOpen(true);
  }

  function handleEditGift(gift: GiftItem) {
    setEditingGift(gift);
    setEditDialogOpen(true);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gift Catalog</CardTitle>
        <CardDescription>Items available for customer rewards</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <GiftsToolbar
          search={search}
          onSearchChange={setSearch}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          stockFilter={stockFilter}
          onStockFilterChange={setStockFilter}
        />

        <GiftsGrid
          gifts={filteredGifts}
          onViewGift={handleViewGift}
          onEditGift={handleEditGift}
          onDeleteGift={handleDeleteGift}
        />

        <GiftDetailsDialog
          gift={selectedGift}
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
        />

        <EditGiftDialog
          gift={editingGift}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      </CardContent>
    </Card>
  );
}
