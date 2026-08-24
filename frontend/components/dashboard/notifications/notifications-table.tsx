import { Bell, Eye } from "lucide-react";

import { ChannelBadge } from "@/components/dashboard/notifications/channel-badge";
import { NotificationStatusBadge } from "@/components/dashboard/notifications/notification-status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import type { NotificationRecord } from "@/lib/mock/notifications";

export function NotificationsTable({
  notifications,
  onViewNotification,
}: {
  notifications: NotificationRecord[];
  onViewNotification: (notification: NotificationRecord) => void;
}) {
  return (
    <div className="rounded-lg border">
      <div className="max-h-[560px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={Bell}
                    title="No notifications found"
                    description="Try adjusting your search, status, or type filter."
                  />
                </TableCell>
              </TableRow>
            )}
            {notifications.map((notification) => (
              <TableRow key={notification.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>
                        {notification.recipientInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {notification.recipientName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {notification.subject}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <ChannelBadge channel={notification.channel} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {notification.type}
                </TableCell>
                <TableCell>
                  <NotificationStatusBadge status={notification.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {notification.sentAt}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`View notification to ${notification.recipientName}`}
                    onClick={() => onViewNotification(notification)}
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
