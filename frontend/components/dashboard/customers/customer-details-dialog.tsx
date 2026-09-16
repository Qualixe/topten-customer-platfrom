import {
  Calendar,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  StickyNote,
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
  wrap = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Break long values onto multiple lines instead of truncating — for
   * fields like a full address that shouldn't be clipped. */
  wrap?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium ${wrap ? "break-words" : "truncate"}`}>{value}</p>
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
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

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Total Orders</p>
                <p className="mt-1 text-lg font-semibold">{customer.totalOrders}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatCurrency(customer.totalSpent)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Last Purchase</p>
                <p className="mt-1 text-lg font-semibold">{customer.lastPurchaseAt}</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-lg border p-4 sm:grid-cols-2">
              <DetailRow icon={Mail} label="Email" value={customer.email} />
              <DetailRow icon={Phone} label="Phone" value={customer.phone} />
              <DetailRow icon={MapPin} label="City" value={customer.city ?? "—"} />
              <DetailRow icon={Calendar} label="Joined" value={customer.joinedAt} />
              <div className="sm:col-span-2">
                <DetailRow icon={MapPin} label="Address" value={customer.address ?? "—"} wrap />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border border-dashed p-3">
                <MessageSquare
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Customer&apos;s Note</p>
                  <p className="mt-1 text-sm break-words whitespace-pre-wrap">
                    {customer.customerNote || "No note from the customer yet."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-dashed p-3">
                <StickyNote
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Internal Notes</p>
                  <p className="mt-1 text-sm break-words whitespace-pre-wrap">
                    {customer.notes || "No notes yet."}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
