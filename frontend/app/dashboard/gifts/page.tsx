import { Clock, Gift, PackageCheck, Truck } from "lucide-react";

import { UpcomingBirthdaysList } from "@/components/dashboard/birthdays/upcoming-birthdays-list";
import { GiftOrdersCard } from "@/components/dashboard/gifts/gift-orders-card";
import { GiftsCatalog } from "@/components/dashboard/gifts/gifts-catalog";
import { GiftsPageHeader } from "@/components/dashboard/gifts/page-header";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { StatsGrid, type StatDefinition } from "@/components/dashboard/stats-grid";
import { getBirthdaysOverview, type BirthdayCustomer } from "@/lib/api/birthdays";
import { getCurrentUserSafe } from "@/lib/api/auth";
import { getGiftStats, listGiftCatalog, listGiftOrders } from "@/lib/api/gifts";

// Real, frequently-changing backend data — must not be statically cached.
export const dynamic = "force-dynamic";

export default async function GiftsPage() {
  const user = await getCurrentUserSafe();
  if (!user?.permissions.includes("gifts.view")) {
    return (
      <div className="flex flex-col gap-6">
        <GiftsPageHeader />
        <PermissionDenied description="Ask an admin to grant you the View gifts permission if you think this is a mistake." />
      </div>
    );
  }

  const canViewBirthdays = user.permissions.includes("customers.view");

  const [{ items: catalog }, { items: orders }, stats, upcomingBirthdays] = await Promise.all([
    listGiftCatalog(),
    listGiftOrders({ pageSize: 100 }),
    getGiftStats(),
    canViewBirthdays
      ? getBirthdaysOverview().then((overview) => overview.upcoming)
      : Promise.resolve<BirthdayCustomer[]>([]),
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
      label: "Pending Gifts",
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
      {canViewBirthdays && <UpcomingBirthdaysList customers={upcomingBirthdays} />}
      <GiftOrdersCard orders={orders} />
      <GiftsCatalog gifts={catalog} />
    </div>
  );
}
