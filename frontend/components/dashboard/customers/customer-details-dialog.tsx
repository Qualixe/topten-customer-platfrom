import {
  Calendar,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

import { CustomerStatusBadge } from "@/components/dashboard/customers/status-badge";
import { CustomerTierBadge } from "@/components/dashboard/customers/tier-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, type Customer } from "@/lib/mock/customers";

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

export function CustomerDetailsDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: Customer | null;
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
                    <CustomerTierBadge tier={customer.tier} />
                    <CustomerStatusBadge status={customer.status} />
                  </div>
                </div>
              </div>
            </DialogHeader>

            <Separator />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailRow icon={Mail} label="Email" value={customer.email} />
              <DetailRow icon={Phone} label="Phone" value={customer.phone} />
              <DetailRow icon={MapPin} label="Address" value={customer.city} />
              <DetailRow icon={Calendar} label="Joined" value={customer.joinedAt} />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Total Orders</p>
                <p className="mt-1 text-lg font-semibold">
                  {customer.totalOrders}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatCurrency(customer.totalSpent)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-dashed p-3">
              <ShoppingBag
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  Last purchase {customer.lastPurchaseAt}
                </p>
                <p className="mt-1 text-sm">{customer.notes}</p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
