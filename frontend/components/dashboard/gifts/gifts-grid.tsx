"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Gift as GiftIcon, MoreVertical, Pencil, Repeat2, Trash2 } from "lucide-react";

import { StockStatusBadge } from "@/components/dashboard/gifts/stock-status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, resolveGiftImageUrl, type GiftItem } from "@/lib/api/gifts";
import { getGiftCategoryVisual } from "@/lib/gift-category-visuals";
import { cn } from "@/lib/utils";

function GiftCardImage({ gift }: { gift: GiftItem }) {
  const visual = getGiftCategoryVisual(gift.category.name);
  const Icon = visual.icon;
  const imageUrl = resolveGiftImageUrl(gift.imageUrl);

  return (
    <div
      className={cn(
        "relative flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden",
        !imageUrl && visual.tileClassName
      )}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover"
        />
      ) : (
        <Icon className={cn("size-10", visual.iconClassName)} aria-hidden="true" />
      )}
    </div>
  );
}

/** Product-grid alternative to GiftsTable — same data, same
 * checkbox-select/actions-menu/click-through-to-detail interactions, just
 * laid out as image-led cards instead of table rows. Same props shape as
 * GiftsTable on purpose, so the parent can swap between them freely. */
export function GiftsGrid({
  gifts,
  canManage,
  selectedIds,
  onToggleSelect,
  onDeleteGift,
}: {
  gifts: GiftItem[];
  canManage: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (gift: GiftItem, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onDeleteGift: (gift: GiftItem) => void;
}) {
  const router = useRouter();

  function goToDetail(gift: GiftItem) {
    router.push(`/dashboard/gifts/${gift.id}`);
  }

  if (gifts.length === 0) {
    return (
      <div className="rounded-lg border">
        <EmptyState
          icon={GiftIcon}
          title="No gifts found"
          description="Try adjusting your search or filters."
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {gifts.map((gift) => {
        const isSelected = selectedIds.has(gift.id);
        return (
          <div
            key={gift.id}
            role="button"
            tabIndex={0}
            onClick={() => goToDetail(gift)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                goToDetail(gift);
              }
            }}
            className={cn(
              "group flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md",
              isSelected && "ring-2 ring-primary"
            )}
          >
            <div className="relative">
              <GiftCardImage gift={gift} />

              {canManage && (
                <div
                  className="absolute top-2 left-2 rounded-md bg-background/80 p-0.5 backdrop-blur-sm"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => onToggleSelect(gift, checked === true)}
                    aria-label={`Select ${gift.name}`}
                  />
                </div>
              )}

              {canManage && (
                <div
                  className="absolute top-2 right-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="secondary"
                          size="icon-sm"
                          className="bg-background/80 backdrop-blur-sm"
                          aria-label={`Actions for ${gift.name}`}
                        />
                      }
                    >
                      <MoreVertical className="size-4" aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => goToDetail(gift)}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => onDeleteGift(gift)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-1.5 p-3">
              <p className="text-xs text-muted-foreground">{gift.category.name}</p>
              <p className="line-clamp-1 text-sm font-medium">{gift.name}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {gift.description || "No description added."}
              </p>

              <div className="mt-auto flex items-center justify-between pt-2">
                <span className="text-sm font-semibold">{formatCurrency(gift.retailValue)}</span>
                <StockStatusBadge status={gift.stockStatus} />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{gift.stockQuantity} in stock</span>
                <span className="inline-flex items-center gap-1">
                  <Repeat2 className="size-3" aria-hidden="true" />
                  {gift.timesRedeemed}×
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
