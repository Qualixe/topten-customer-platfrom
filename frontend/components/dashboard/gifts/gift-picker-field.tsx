"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, Gift as GiftIcon, Search } from "lucide-react";

import { StockStatusBadge } from "@/components/dashboard/gifts/stock-status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency, resolveGiftImageUrl, type GiftItem } from "@/lib/api/gifts";
import { getGiftCategoryVisual } from "@/lib/gift-category-visuals";
import { cn } from "@/lib/utils";

function GiftThumb({
  gift,
  className,
  iconClassName = "size-6",
}: {
  gift: GiftItem;
  className?: string;
  iconClassName?: string;
}) {
  const visual = getGiftCategoryVisual(gift.category.name);
  const Icon = visual.icon;
  const imageUrl = resolveGiftImageUrl(gift.imageUrl);

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md",
        !imageUrl && visual.tileClassName,
        className
      )}
    >
      {imageUrl ? (
        <Image src={imageUrl} alt="" fill unoptimized className="object-cover" />
      ) : (
        <Icon className={cn(iconClassName, visual.iconClassName)} aria-hidden="true" />
      )}
    </div>
  );
}

/** Shopify-style picker: a preview tile that opens a searchable, thumbnailed
 * grid of the catalog instead of a plain text dropdown — gifts are visual
 * items, and a name-only `<select>` makes them hard to tell apart. */
export function GiftPickerField({
  catalog,
  value,
  onChange,
}: {
  catalog: GiftItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = catalog.find((item) => item.id === value) ?? null;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return catalog;
    return catalog.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.category.name.toLowerCase().includes(query)
    );
  }, [catalog, search]);

  function handleSelect(item: GiftItem) {
    onChange(item.id);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors hover:bg-muted/50",
              !selected && "justify-center border-dashed py-6 text-muted-foreground"
            )}
          />
        }
      >
        {selected ? (
          <>
            <GiftThumb gift={selected} className="size-12" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{selected.name}</p>
              <p className="truncate text-xs text-muted-foreground">{selected.category.name}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-semibold">{formatCurrency(selected.retailValue)}</span>
              <StockStatusBadge status={selected.stockStatus} />
            </div>
            <span className="shrink-0 text-xs font-medium text-primary">Change</span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1.5">
            <GiftIcon className="size-6" aria-hidden="true" />
            <span className="text-sm font-medium">Select a gift</span>
          </span>
        )}
      </DialogTrigger>

      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select a gift</DialogTitle>
          <DialogDescription>Choose an item from the catalog to send.</DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search gifts by name or category…"
            className="pl-8"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              No gifts found.
            </p>
          )}
          {filtered.map((item) => {
            const isSelected = item.id === value;
            const outOfStock = item.stockStatus === "OUT_OF_STOCK";
            return (
              <button
                key={item.id}
                type="button"
                disabled={outOfStock}
                onClick={() => handleSelect(item)}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-2 text-left transition-colors",
                  outOfStock ? "cursor-not-allowed opacity-50" : "hover:bg-muted/50",
                  isSelected && "border-primary ring-1 ring-primary"
                )}
              >
                <div className="relative">
                  <GiftThumb gift={item} className="h-20 w-full" iconClassName="size-8" />
                  {isSelected && (
                    <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{item.name}</p>
                  <div className="mt-0.5 flex items-center justify-between gap-1">
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(item.retailValue)}
                    </span>
                    <StockStatusBadge status={item.stockStatus} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
