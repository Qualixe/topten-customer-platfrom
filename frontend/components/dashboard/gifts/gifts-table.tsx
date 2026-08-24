import { Eye, Gift as GiftIcon } from "lucide-react";

import { StockStatusBadge } from "@/components/dashboard/gifts/stock-status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, type GiftItem } from "@/lib/mock/gifts";

export function GiftsTable({
  gifts,
  onViewGift,
}: {
  gifts: GiftItem[];
  onViewGift: (gift: GiftItem) => void;
}) {
  return (
    <div className="rounded-lg border">
      <div className="max-h-[560px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Gift</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Points Cost</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Redeemed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gifts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={GiftIcon}
                    title="No gifts found"
                    description="Try adjusting your search or filters."
                  />
                </TableCell>
              </TableRow>
            )}
            {gifts.map((gift) => (
              <TableRow key={gift.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                      <GiftIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{gift.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatCurrency(gift.retailValue)} value
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {gift.category}
                </TableCell>
                <TableCell className="font-medium">
                  {gift.pointsCost.toLocaleString("en-US")} pts
                </TableCell>
                <TableCell>
                  <StockStatusBadge status={gift.stockStatus} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {gift.timesRedeemed}×
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`View ${gift.name}`}
                    onClick={() => onViewGift(gift)}
                  >
                    <Eye />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
