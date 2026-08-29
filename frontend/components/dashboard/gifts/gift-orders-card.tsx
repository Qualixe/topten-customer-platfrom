"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarClock, Clock, Send, X } from "lucide-react";

import { GiftStatusBadge } from "@/components/dashboard/gifts/gift-status-badge";
import { ScheduleGiftDialog } from "@/components/dashboard/gifts/schedule-gift-dialog";
import { usePermissions } from "@/components/providers/permissions-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateGiftOrderStatus, type GiftOrder, type GiftOrderStatus } from "@/lib/api/gifts";
import { getErrorMessage } from "@/lib/api/types";

type StatusFilter = GiftOrderStatus | "all";

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All Orders",
  PENDING: "Pending",
  SCHEDULED: "Scheduled",
  SENT: "Sent",
  CANCELLED: "Cancelled",
};

/** No general activity log exists for gift orders — `createdAt` is the one
 * real timestamp every order has, so that's what's shown. */
function relativeTimeFrom(iso: string): string {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return "";

  const diffMs = Date.now() - created;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function GiftOrdersCard({ orders }: { orders: GiftOrder[] }) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("gifts.manage");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [schedulingOrder, setSchedulingOrder] = useState<GiftOrder | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  const filteredOrders = orders.filter(
    (order) => statusFilter === "all" || order.status === statusFilter
  );

  function handleSchedule(order: GiftOrder) {
    setSchedulingOrder(order);
    setScheduleDialogOpen(true);
  }

  async function handleSend(order: GiftOrder) {
    if (!window.confirm(`Send "${order.giftName}" to ${order.customerName} now?`)) return;
    try {
      await updateGiftOrderStatus(order.id, { status: "SENT" });
      router.refresh();
    } catch (err) {
      window.alert(getErrorMessage(err, "Unable to send this gift."));
    }
  }

  async function handleCancel(order: GiftOrder) {
    if (!window.confirm(`Cancel the gift order for ${order.customerName}?`)) return;
    try {
      await updateGiftOrderStatus(order.id, { status: "CANCELLED" });
      router.refresh();
    } catch (err) {
      window.alert(getErrorMessage(err, "Unable to cancel this gift order."));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gift Orders</CardTitle>
        <CardDescription>Track and send queued gift orders</CardDescription>
        <CardAction className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter((value as StatusFilter) ?? "all")}
          >
            <SelectTrigger className="w-36" aria-label="Filter by status">
              <SelectValue>{(value: StatusFilter) => STATUS_FILTER_LABELS[value]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(STATUS_FILTER_LABELS) as [StatusFilter, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          {canManage && (
            <Button nativeButton={false} render={<Link href="/dashboard/gifts/send" />}>
              <Send />
              Send Gift
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
            <Clock className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No gift orders here right now.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
              >
                <Avatar>
                  <AvatarFallback>{order.customerInitials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{order.customerName}</p>
                    {order.customerTier === "VIP" && (
                      <Badge variant="secondary" className="shrink-0">
                        VIP
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {order.giftName} · {order.occasion.replace(/_/g, " ").toLowerCase()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <GiftStatusBadge status={order.status} />
                  <span className="text-xs text-muted-foreground">
                    {relativeTimeFrom(order.createdAt)}
                  </span>
                </div>
                {canManage && (order.status === "PENDING" || order.status === "SCHEDULED") && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Schedule gift for ${order.customerName}`}
                      onClick={() => handleSchedule(order)}
                    >
                      <CalendarClock />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Send gift to ${order.customerName}`}
                      onClick={() => handleSend(order)}
                    >
                      <Send />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Cancel gift order for ${order.customerName}`}
                      onClick={() => handleCancel(order)}
                    >
                      <X />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ScheduleGiftDialog
        order={schedulingOrder}
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
      />
    </Card>
  );
}
