"use client";

import { useMemo, useState } from "react";

import { GiftDetailsDialog } from "@/components/dashboard/gifts/gift-details-dialog";
import {
  GiftsToolbar,
  type CategoryFilter,
  type StockFilter,
} from "@/components/dashboard/gifts/gifts-toolbar";
import { GiftsTable } from "@/components/dashboard/gifts/gifts-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GiftItem } from "@/lib/mock/gifts";

export function GiftsCatalog({ gifts }: { gifts: GiftItem[] }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
    setDialogOpen(true);
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

        <GiftsTable gifts={filteredGifts} onViewGift={handleViewGift} />

        <GiftDetailsDialog
          gift={selectedGift}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </CardContent>
    </Card>
  );
}
