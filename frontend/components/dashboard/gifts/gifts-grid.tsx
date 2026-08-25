import { Gift as GiftIcon } from "lucide-react";

import { GiftCard } from "@/components/dashboard/gifts/gift-card";
import { usePermissions } from "@/components/providers/permissions-provider";
import { EmptyState } from "@/components/ui/empty-state";
import type { GiftItem } from "@/lib/api/gifts";

export function GiftsGrid({
  gifts,
  onViewGift,
  onEditGift,
  onDeleteGift,
}: {
  gifts: GiftItem[];
  onViewGift: (gift: GiftItem) => void;
  onEditGift: (gift: GiftItem) => void;
  onDeleteGift: (gift: GiftItem) => void;
}) {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("gifts.manage");

  if (gifts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed">
        <EmptyState
          icon={GiftIcon}
          title="No gifts found"
          description="Try adjusting your search or filters."
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {gifts.map((gift) => (
        <GiftCard
          key={gift.id}
          gift={gift}
          canManage={canManage}
          onView={onViewGift}
          onEdit={onEditGift}
          onDelete={onDeleteGift}
        />
      ))}
    </div>
  );
}
