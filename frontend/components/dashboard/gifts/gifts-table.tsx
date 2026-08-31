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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, resolveGiftImageUrl, type GiftItem } from "@/lib/api/gifts";
import { getGiftCategoryVisual } from "@/lib/gift-category-visuals";
import { cn } from "@/lib/utils";

function GiftThumb({ gift }: { gift: GiftItem }) {
  const visual = getGiftCategoryVisual(gift.category.name);
  const Icon = visual.icon;
  const imageUrl = resolveGiftImageUrl(gift.imageUrl);

  return (
    <div
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md",
        !imageUrl && visual.tileClassName
      )}
    >
      {imageUrl ? (
        <Image src={imageUrl} alt="" fill className="object-cover" />
      ) : (
        <Icon className={cn("size-4.5", visual.iconClassName)} aria-hidden="true" />
      )}
    </div>
  );
}

/** Shopify-style product table: a thumbnail+title lead column, checkbox
 * bulk-selection, a whole row that's clickable through to the detail page
 * (except the checkbox and the actions menu, which stop that click), and a
 * per-row "..." menu for the same Edit/Delete actions the checkbox column
 * doesn't cover in bulk. */
export function GiftsTable({
  gifts,
  canManage,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
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

  const allSelected = gifts.length > 0 && gifts.every((gift) => selectedIds.has(gift.id));
  const someSelected = !allSelected && gifts.some((gift) => selectedIds.has(gift.id));

  function goToDetail(gift: GiftItem) {
    router.push(`/dashboard/gifts/${gift.id}`);
  }

  return (
    <div className="rounded-lg border">
      <div className="max-h-[640px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              {canManage && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={(checked) => onToggleSelectAll(checked === true)}
                    aria-label="Select all gifts"
                  />
                </TableHead>
              )}
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Inventory</TableHead>
              <TableHead>Redeemed</TableHead>
              <TableHead className="text-right">Price</TableHead>
              {canManage && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {gifts.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 8 : 6} className="p-0">
                  <EmptyState
                    icon={GiftIcon}
                    title="No gifts found"
                    description="Try adjusting your search or filters."
                  />
                </TableCell>
              </TableRow>
            )}
            {gifts.map((gift) => {
              const isSelected = selectedIds.has(gift.id);
              return (
                <TableRow
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
                  className={cn("cursor-pointer", isSelected && "bg-muted/40")}
                >
                  {canManage && (
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => onToggleSelect(gift, checked === true)}
                        aria-label={`Select ${gift.name}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <GiftThumb gift={gift} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{gift.name}</p>
                        <p className="max-w-xs truncate text-xs text-muted-foreground">
                          {gift.description || "No description added."}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{gift.category.name}</TableCell>
                  <TableCell>
                    <StockStatusBadge status={gift.stockStatus} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {gift.stockQuantity} in stock
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Repeat2 className="size-3.5" aria-hidden="true" />
                      {gift.timesRedeemed}×
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(gift.retailValue)}
                  </TableCell>
                  {canManage && (
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
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
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onDeleteGift(gift)}
                          >
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
