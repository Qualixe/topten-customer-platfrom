import { Eye, Truck } from "lucide-react";

import { DeliveryStatusBadge } from "@/components/dashboard/couriers/delivery-status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import type { Delivery } from "@/lib/mock/deliveries";

export function DeliveriesTable({
  deliveries,
  onViewDelivery,
}: {
  deliveries: Delivery[];
  onViewDelivery: (delivery: Delivery) => void;
}) {
  return (
    <div className="rounded-lg border">
      <div className="max-h-[560px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Tracking Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Gift</TableHead>
              <TableHead>Courier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={Truck}
                    title="No deliveries found"
                    description="Try adjusting your search or filters."
                  />
                </TableCell>
              </TableRow>
            )}
            {deliveries.map((delivery) => (
              <TableRow key={delivery.id}>
                <TableCell className="font-mono text-sm">
                  {delivery.trackingNumber}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>{delivery.customerInitials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium">
                          {delivery.customerName}
                        </p>
                        {delivery.customerTier === "VIP" && (
                          <Badge variant="secondary" className="shrink-0">
                            VIP
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {delivery.city}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {delivery.giftName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {delivery.courier}
                </TableCell>
                <TableCell>
                  <DeliveryStatusBadge status={delivery.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`View delivery ${delivery.trackingNumber}`}
                    onClick={() => onViewDelivery(delivery)}
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
