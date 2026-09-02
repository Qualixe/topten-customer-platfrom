import { Clock, Gift, PackageCheck, Truck } from "lucide-react";

import { UpcomingBirthdaysList } from "@/components/dashboard/birthdays/upcoming-birthdays-list";
import { GiftOrdersCard } from "@/components/dashboard/gifts/gift-orders-card";
import { GiftsPageHeader } from "@/components/dashboard/gifts/page-header";
import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { StatsSectionCard } from "@/components/dashboard/stats-section-card";
import type { StatDefinition } from "@/components/dashboard/stats-grid";
import { getBirthdaysOverview, type BirthdayCustomer } from "@/lib/api/birthdays";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { getGiftStats, listGiftOrders } from "@/lib/api/gifts";
import { settleOk } from "@/lib/api/settle";

// Real, frequently-changing backend data — must not be statically cached.
export const dynamic = "force-dynamic";

export default async function GiftsPage() {
  // Fired alongside the permission check instead of after it — halves the
  // number of sequential round trips this page needs before it can render.
  // The birthdays fetch is unconditional here (unlike before) since
  // whether it's actually needed depends on a permission only known once
  // `user` resolves — cheap enough to just always fetch and discard.
  const [user, ordersResult, statsResult, birthdaysResult] = await Promise.all([
    getCurrentUserSafeCached(),
    settleOk(listGiftOrders({ pageSize: 100 })),
    settleOk(getGiftStats()),
    settleOk(getBirthdaysOverview().then((overview) => overview.upcoming)),
  ]);
  if (!user?.permissions.includes("gifts.view")) {
    return (
      <div className="flex flex-col gap-6">
        <GiftsPageHeader />
        <PermissionDenied description="Ask an admin to grant you the View gifts permission if you think this is a mistake." />
      </div>
    );
  }

  const canViewBirthdays = user.permissions.includes("customers.view");
  // Guaranteed defined here — the backend enforces the same permission
  // just checked above, so an authorized user's fetches cannot have failed.
  const { items: orders } = ordersResult!;
  const stats = statsResult!;
  const upcomingBirthdays = canViewBirthdays
    ? (birthdaysResult ?? ([] as BirthdayCustomer[]))
    : ([] as BirthdayCustomer[]);

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
      <StatsSectionCard title="Gift Orders" stats={statDefinitions} />
      {canViewBirthdays && <UpcomingBirthdaysList customers={upcomingBirthdays} />}
      <GiftOrdersCard orders={orders} />
    </div>
  );
}
