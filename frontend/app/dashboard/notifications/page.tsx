import { AlertTriangle, CheckCircle2, Percent, Send } from "lucide-react";

import { FailedNotifications } from "@/components/dashboard/notifications/failed-notifications";
import { NotificationsPageHeader } from "@/components/dashboard/notifications/page-header";
import { NotificationsWorkspace } from "@/components/dashboard/notifications/notifications-workspace";
import { StatsGrid, type StatDefinition } from "@/components/dashboard/stats-grid";
import {
  getNotificationStats,
  listNotifications,
} from "@/lib/api/notifications";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const [{ items: notifications }, { items: failedNotifications }, stats] =
    await Promise.all([
      listNotifications(),
      listNotifications({ status: "Failed" }),
      getNotificationStats(),
    ]);

  const statDefinitions: StatDefinition[] = [
    {
      key: "total",
      label: "Total Notifications",
      value: String(stats.total),
      caption: "Across all channels",
      icon: Send,
    },
    {
      key: "delivered",
      label: "Delivered",
      value: String(stats.delivered),
      caption: "Confirmed delivery",
      icon: CheckCircle2,
    },
    {
      key: "failed",
      label: "Failed",
      value: String(stats.failed),
      caption: "Needs attention",
      icon: AlertTriangle,
    },
    {
      key: "rate",
      label: "Delivery Rate",
      value: `${stats.deliveryRate}%`,
      caption: "Of all notifications sent",
      icon: Percent,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <NotificationsPageHeader />
      <StatsGrid stats={statDefinitions} />
      <FailedNotifications notifications={failedNotifications} />
      <NotificationsWorkspace notifications={notifications} />
    </div>
  );
}
