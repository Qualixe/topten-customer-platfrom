import { Clock } from "lucide-react";

import { GiftStatusBadge } from "@/components/dashboard/gifts/gift-status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GiftOrder } from "@/lib/mock/gifts";

export function PendingOrders({ orders }: { orders: GiftOrder[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Gift Orders</CardTitle>
        <CardDescription>Requests waiting to be scheduled</CardDescription>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
            <Clock className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              No pending gift orders right now.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
              >
                <Avatar>
                  <AvatarFallback>{order.customerInitials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {order.customerName}
                    </p>
                    {order.customerTier === "VIP" && (
                      <Badge variant="secondary" className="shrink-0">
                        VIP
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {order.giftName} · {order.occasion}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <GiftStatusBadge status={order.status} />
                  <span className="text-xs text-muted-foreground">
                    {order.requestedAt}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
