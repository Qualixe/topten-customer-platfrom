import { Clock, Gift, PackageCheck, Truck } from "lucide-react";

import { GiftsCatalog } from "@/components/dashboard/gifts/gifts-catalog";
import { GiftsPageHeader } from "@/components/dashboard/gifts/page-header";
import { PendingOrders } from "@/components/dashboard/gifts/pending-orders";
import { StatsGrid, type StatDefinition } from "@/components/dashboard/stats-grid";
import { getGiftStats, listGiftCatalog, listGiftOrders } from "@/lib/api/gifts";

export default async function GiftsPage() {
  const [{ items: catalog }, { items: pendingOrders }, stats] = await Promise.all([
    listGiftCatalog(),
    listGiftOrders({ status: "Pending" }),
    getGiftStats(),
  ]);

  const statDefinitions: StatDefinition[] = [
    {
      key: "catalog",
      label: "Gifts in Catalog",
      value: stats.totalGiftsInCatalog,
      caption: "Across all categories",
      icon: Gift,
    },
    {
      key: "pending",
      label: "Pending Orders",
      value: stats.pendingOrdersCount,
      caption: "Awaiting scheduling",
      icon: Clock,
    },
    {
      key: "scheduled",
      label: "Scheduled Deliveries",
      value: stats.scheduledOrdersCount,
      caption: "Ready to be sent",
      icon: Truck,
    },
    {
      key: "sent",
      label: "Gifts Sent",
      value: stats.sentOrdersCount,
      caption: "Delivered to customers",
      icon: PackageCheck,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <GiftsPageHeader />
      <StatsGrid stats={statDefinitions} />
      <PendingOrders orders={pendingOrders} />
      <GiftsCatalog gifts={catalog} />
    </div>
  );
}
