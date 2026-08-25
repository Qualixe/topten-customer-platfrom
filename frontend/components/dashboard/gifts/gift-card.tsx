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
import { formatCurrency, GIFT_CATEGORY_LABELS, type GiftItem } from "@/lib/api/gifts";
import { GIFT_CATEGORY_VISUALS } from "@/lib/gift-category-visuals";
import { cn } from "@/lib/utils";

export function GiftCard({
  gift,
  canManage,
  onView,
  onEdit,
  onDelete,
}: {
  gift: GiftItem;
  canManage: boolean;
  onView: (gift: GiftItem) => void;
  onEdit: (gift: GiftItem) => void;
  onDelete: (gift: GiftItem) => void;
}) {
  const visual = GIFT_CATEGORY_VISUALS[gift.category];
  const Icon = visual.icon;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onView(gift)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onView(gift);
        }
      }}
      className="cursor-pointer transition-shadow hover:shadow-md hover:ring-foreground/15"
    >
      <CardContent className="flex flex-col gap-3">
        <div
          className={cn(
            "relative flex h-24 items-center justify-center rounded-lg",
            visual.tileClassName
          )}
        >
          <Icon className={cn("size-9", visual.iconClassName)} aria-hidden="true" />

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
                  <DropdownMenuItem onClick={() => onEdit(gift)}>
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
          <p className="text-xs font-medium text-muted-foreground">
            {GIFT_CATEGORY_LABELS[gift.category]}
          </p>
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
