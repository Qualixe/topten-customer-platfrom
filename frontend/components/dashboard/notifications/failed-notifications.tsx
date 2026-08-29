import { AlertTriangle } from "lucide-react";

import { ChannelBadge } from "@/components/dashboard/notifications/channel-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNotificationDateTime, type NotificationRecord } from "@/lib/api/notifications";

export function FailedNotifications({
  notifications,
}: {
  notifications: NotificationRecord[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
          Failed Notifications
        </CardTitle>
        <CardDescription>Messages that could not be delivered</CardDescription>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
            <AlertTriangle className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              No failed notifications right now.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5"
              >
                <Avatar>
                  <AvatarFallback>{notification.recipientInitials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {notification.recipientName}
                    </p>
                    <ChannelBadge channel={notification.channel} />
                  </div>
                  <p className="truncate text-xs text-destructive/90">
                    {notification.failureReason}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatNotificationDateTime(notification.sentAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
