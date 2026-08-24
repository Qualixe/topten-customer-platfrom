"use client";

import { useMemo, useState } from "react";

import { NotificationDetailsDialog } from "@/components/dashboard/notifications/notification-details-dialog";
import { NotificationsTable } from "@/components/dashboard/notifications/notifications-table";
import {
  NotificationsToolbar,
  type StatusFilter,
  type TypeFilter,
} from "@/components/dashboard/notifications/notifications-toolbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { NotificationChannel, NotificationRecord } from "@/lib/api/notifications";

type ChannelTab = NotificationChannel | "all";

export function NotificationsWorkspace({
  notifications,
}: {
  notifications: NotificationRecord[];
}) {
  const [channelTab, setChannelTab] = useState<ChannelTab>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedNotification, setSelectedNotification] =
    useState<NotificationRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const channelCounts = useMemo(() => {
    const counts: Record<NotificationChannel, number> = {
      SMS: 0,
      Email: 0,
      WhatsApp: 0,
    };

    for (const notification of notifications) {
      counts[notification.channel] += 1;
    }

    return counts;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLowerCase();

    return notifications.filter((notification) => {
      const matchesChannel =
        channelTab === "all" || notification.channel === channelTab;
      const matchesQuery =
        query.length === 0 ||
        notification.recipientName.toLowerCase().includes(query) ||
        notification.subject.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" || notification.status === statusFilter;
      const matchesType = typeFilter === "all" || notification.type === typeFilter;

      return matchesChannel && matchesQuery && matchesStatus && matchesType;
    });
  }, [notifications, channelTab, search, statusFilter, typeFilter]);

  function handleViewNotification(notification: NotificationRecord) {
    setSelectedNotification(notification);
    setDialogOpen(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification History</CardTitle>
        <CardDescription>
          All messages sent to customers, across every channel
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs
          value={channelTab}
          onValueChange={(value) => setChannelTab(value as ChannelTab)}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="SMS">SMS ({channelCounts.SMS})</TabsTrigger>
            <TabsTrigger value="Email">Email ({channelCounts.Email})</TabsTrigger>
            <TabsTrigger value="WhatsApp">
              WhatsApp ({channelCounts.WhatsApp})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <NotificationsToolbar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
        />

        <NotificationsTable
          notifications={filteredNotifications}
          onViewNotification={handleViewNotification}
        />

        <NotificationDetailsDialog
          notification={selectedNotification}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </CardContent>
    </Card>
  );
}
