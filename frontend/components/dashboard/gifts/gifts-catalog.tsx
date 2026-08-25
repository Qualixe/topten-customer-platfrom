"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { GiftsGrid } from "@/components/dashboard/gifts/gifts-grid";
import {
  GiftsToolbar,
  type CategoryFilter,
  type StockFilter,
} from "@/components/dashboard/gifts/gifts-toolbar";
import { Card, CardContent } from "@/components/ui/card";
import { deleteGiftCatalogItem, type GiftCategoryOption, type GiftItem } from "@/lib/api/gifts";
import { getErrorMessage } from "@/lib/api/types";

export function GiftsCatalog({ gifts }: { gifts: GiftItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");

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
      <CardContent className="flex flex-col gap-4">
        <GiftsToolbar
          search={search}
          onSearchChange={setSearch}
          categories={categories}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          stockFilter={stockFilter}
          onStockFilterChange={setStockFilter}
        />

        <GiftsGrid gifts={filteredGifts} onDeleteGift={handleDeleteGift} />
      </CardContent>
    </Card>
  );
}
