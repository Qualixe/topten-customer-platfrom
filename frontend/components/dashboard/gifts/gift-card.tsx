"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Repeat2, Trash2 } from "lucide-react";

import { StockStatusBadge } from "@/components/dashboard/gifts/stock-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, resolveGiftImageUrl, type GiftItem } from "@/lib/api/gifts";
import { getGiftCategoryVisual } from "@/lib/gift-category-visuals";
import { cn } from "@/lib/utils";

export function GiftCard({
  gift,
  canManage,
  onDelete,
}: {
  gift: GiftItem;
  canManage: boolean;
  onDelete: (gift: GiftItem) => void;
}) {
  const router = useRouter();
  const visual = getGiftCategoryVisual(gift.category.name);
  const Icon = visual.icon;
  const imageUrl = resolveGiftImageUrl(gift.imageUrl);

  function goToDetail() {
    router.push(`/dashboard/gifts/${gift.id}`);
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={goToDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          goToDetail();
        }
      }}
      className="cursor-pointer transition-shadow hover:shadow-md hover:ring-foreground/15"
    >
      <CardContent className="flex flex-col gap-3">
        <div
          className={cn(
            "relative flex h-24 items-center justify-center overflow-hidden rounded-lg",
            !imageUrl && visual.tileClassName
          )}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt=""
              fill
              unoptimized
              className="object-cover"
            />
          ) : (
            <Icon className={cn("size-9", visual.iconClassName)} aria-hidden="true" />
          )}

          <div className="absolute top-2 left-2">
            <StockStatusBadge status={gift.stockStatus} />
          </div>

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
                      className="size-7 bg-background/80 shadow-sm backdrop-blur"
                      aria-label={`Actions for ${gift.name}`}
                    />
                  }
                >
                  <MoreVertical className="size-3.5" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={goToDetail}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(gift)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{gift.category.name}</p>
          <h3 className="truncate text-sm font-semibold">{gift.name}</h3>
        </div>

        <p className="line-clamp-2 min-h-8 text-xs text-muted-foreground">
          {gift.description || "No description added."}
        </p>
      </CardContent>

      <CardContent className="flex items-end justify-between pt-0">
        <div>
          <p className="text-sm font-semibold">{gift.pointsCost.toLocaleString("en-US")} pts</p>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(gift.retailValue)} value
          </p>
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Repeat2 className="size-3.5" aria-hidden="true" />
          {gift.timesRedeemed}×
        </p>
      </CardContent>
    </Card>
  );
}
