import { Coins, Gift as GiftIcon, Repeat, Tag } from "lucide-react";

import { StockStatusBadge } from "@/components/dashboard/gifts/stock-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, GIFT_CATEGORY_LABELS, type GiftItem } from "@/lib/api/gifts";

export function GiftDetailsDialog({
  gift,
  open,
  onOpenChange,
}: {
  gift: GiftItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {gift && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted">
                  <GiftIcon className="size-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="truncate">{gift.name}</DialogTitle>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge variant="outline">{GIFT_CATEGORY_LABELS[gift.category]}</Badge>
                    <StockStatusBadge status={gift.stockStatus} />
                  </div>
                </div>
              </div>
              <DialogDescription>{gift.description}</DialogDescription>
            </DialogHeader>

            <Separator />

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted p-3">
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Coins className="size-3" aria-hidden="true" />
                  Points Cost
                </p>
                <p className="mt-1 text-base font-semibold">
                  {gift.pointsCost.toLocaleString("en-US")}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Tag className="size-3" aria-hidden="true" />
                  Retail Value
                </p>
                <p className="mt-1 text-base font-semibold">
                  {formatCurrency(gift.retailValue)}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Repeat className="size-3" aria-hidden="true" />
                  Redeemed
                </p>
                <p className="mt-1 text-base font-semibold">
                  {gift.timesRedeemed}×
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              {gift.stockQuantity > 0
                ? `${gift.stockQuantity} units currently available.`
                : "Currently out of stock — new requests will be queued."}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
