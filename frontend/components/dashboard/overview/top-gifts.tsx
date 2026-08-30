import Image from "next/image";
import Link from "next/link";
import { Gift as GiftIcon, Repeat2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, resolveGiftImageUrl, type GiftItem } from "@/lib/api/gifts";
import { getGiftCategoryVisual } from "@/lib/gift-category-visuals";
import { cn } from "@/lib/utils";

export function TopGifts({ gifts }: { gifts: GiftItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Redeemed Gifts</CardTitle>
        <CardDescription>Most sent from the catalog</CardDescription>
      </CardHeader>
      <CardContent>
        {gifts.length === 0 ? (
          <EmptyState
            icon={GiftIcon}
            title="No gifts redeemed yet"
            description="Sent gifts will show up here, ranked by how often they're redeemed."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {gifts.map((gift) => {
              const visual = getGiftCategoryVisual(gift.category.name);
              const Icon = visual.icon;
              const imageUrl = resolveGiftImageUrl(gift.imageUrl);

              return (
                <div key={gift.id} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md",
                      !imageUrl && visual.tileClassName
                    )}
                  >
                    {imageUrl ? (
                      <Image src={imageUrl} alt="" fill unoptimized className="object-cover" />
                    ) : (
                      <Icon className={cn("size-4.5", visual.iconClassName)} aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{gift.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatCurrency(gift.retailValue)}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Repeat2 className="size-3.5" aria-hidden="true" />
                    {gift.timesRedeemed}×
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <Link
          href="/dashboard/gifts/catalog"
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          View gift catalog
        </Link>
      </CardContent>
    </Card>
  );
}
