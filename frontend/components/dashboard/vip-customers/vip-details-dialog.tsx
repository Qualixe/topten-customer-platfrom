import {
  Calendar,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

import { VipSegmentBadge } from "@/components/dashboard/vip-customers/vip-segment-badge";
import { VipStatusBadge } from "@/components/dashboard/vip-customers/vip-status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, type VipCustomer } from "@/lib/api/vip-customers";

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export function VipDetailsDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: VipCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {customer && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  <AvatarFallback>{customer.initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <DialogTitle className="truncate">{customer.name}</DialogTitle>
                  <div className="mt-1 flex items-center gap-1.5">
                    <VipSegmentBadge segment={customer.segment} />
                    <VipStatusBadge status={customer.status} />
                  </div>
                </div>
              </div>
            </DialogHeader>

            <Separator />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailRow icon={Mail} label="Email" value={customer.email ?? "No email on file"} />
              <DetailRow icon={Phone} label="Phone" value={customer.phone} />
              <DetailRow icon={MapPin} label="City" value={customer.city} />
              <DetailRow
                icon={Calendar}
                label="Member Since"
                value={customer.memberSince}
              />
            </div>

            <Separator />

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Spending Summary
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Total Spent</p>
                  <p className="mt-1 text-base font-semibold">
                    {formatCurrency(customer.totalSpent)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Last Purchase</p>
                  <p className="mt-1 text-base font-semibold">
                    {customer.lastPurchaseLabel}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-dashed p-3">
              <ShoppingBag
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                Total spend is calculated from all recorded POS purchases.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
