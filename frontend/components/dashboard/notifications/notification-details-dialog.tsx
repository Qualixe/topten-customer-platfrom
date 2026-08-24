import { AlertTriangle, Clock, Send } from "lucide-react";

import { ChannelBadge } from "@/components/dashboard/notifications/channel-badge";
import { NotificationStatusBadge } from "@/components/dashboard/notifications/notification-status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { NotificationRecord } from "@/lib/mock/notifications";

export function NotificationDetailsDialog({
  notification,
  open,
  onOpenChange,
}: {
  notification: NotificationRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {notification && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {notification.recipientInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <DialogTitle className="truncate">
                    {notification.recipientName}
                  </DialogTitle>
                  <p className="truncate text-xs text-muted-foreground">
                    {notification.recipientContact}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <ChannelBadge channel={notification.channel} />
                <NotificationStatusBadge status={notification.status} />
              </div>
            </DialogHeader>

            <Separator />

            <div>
              <p className="text-xs text-muted-foreground">{notification.type}</p>
              <p className="mt-1 text-sm font-medium">{notification.subject}</p>
              <p className="mt-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                {notification.message}
              </p>
            </div>

            {notification.status === "Failed" && notification.failureReason && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>{notification.failureReason}</p>
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Send className="size-3" aria-hidden="true" />
                  Sent
                </p>
                <p className="mt-0.5 font-medium">{notification.sentAt}</p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" aria-hidden="true" />
                  Delivered
                </p>
                <p className="mt-0.5 font-medium">
                  {notification.deliveredAt ?? "—"}
                </p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
