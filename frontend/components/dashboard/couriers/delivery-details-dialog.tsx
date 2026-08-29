"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Package,
  Truck,
} from "lucide-react";

import { DeliveryStatusBadge } from "@/components/dashboard/couriers/delivery-status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { updateDeliveryStatus, type Delivery, type DeliveryStatus } from "@/lib/api/deliveries";
import { getErrorMessage } from "@/lib/api/types";

const STATUS_OPTIONS: DeliveryStatus[] = [
  "Pending Pickup",
  "In Transit",
  "Out for Delivery",
  "Delivered",
  "Failed",
  "Returned",
];

const TRACKING_STEPS: { status: DeliveryStatus; label: string }[] = [
  { status: "Pending Pickup", label: "Pending Pickup" },
  { status: "In Transit", label: "In Transit" },
  { status: "Out for Delivery", label: "Out for Delivery" },
  { status: "Delivered", label: "Delivered" },
];

function DeliveryTracker({ status }: { status: DeliveryStatus }) {
  if (status === "Failed" || status === "Returned") {
    return null;
  }

  const currentIndex = TRACKING_STEPS.findIndex((step) => step.status === status);

  return (
    <div className="flex items-center">
      {TRACKING_STEPS.map((step, index) => {
        const isComplete = index <= currentIndex;
        const isLast = index === TRACKING_STEPS.length - 1;

        return (
          <div key={step.status} className={cn("flex items-center", !isLast && "flex-1")}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                  isComplete
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                )}
              </div>
              <span className="max-w-16 text-center text-[0.65rem] text-muted-foreground">
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  "mx-1 h-0.5 flex-1",
                  index < currentIndex ? "bg-primary" : "bg-border"
                )}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DeliveryDetailsDialog({
  delivery,
  open,
  onOpenChange,
  canManage,
}: {
  delivery: Delivery | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {delivery && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="font-mono text-sm">
                    {delivery.trackingNumber}
                  </DialogTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Shipped via {delivery.courier}
                  </p>
                </div>
                <DeliveryStatusBadge status={delivery.status} />
              </div>
            </DialogHeader>

            <Separator />

            {(delivery.status === "Failed" || delivery.status === "Returned") && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>{delivery.notes}</p>
              </div>
            )}

            <DeliveryTracker status={delivery.status} />

            <Separator />

            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>{delivery.customerInitials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
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
                <p className="flex items-start gap-1 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                  {delivery.address}, {delivery.city}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-muted p-3">
              <Package className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Gift</p>
                <p className="text-sm font-medium">{delivery.giftName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Truck className="size-3" aria-hidden="true" />
                  Dispatched
                </p>
                <p className="mt-0.5 font-medium">{delivery.dispatchedAt}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {delivery.deliveredAt ? "Delivered" : "Estimated Delivery"}
                </p>
                <p className="mt-0.5 font-medium">
                  {delivery.deliveredAt ?? delivery.estimatedDelivery}
                </p>
              </div>
            </div>

            {canManage && (
              <>
                <Separator />
                <UpdateStatusForm key={delivery.id} delivery={delivery} />
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UpdateStatusForm({ delivery }: { delivery: Delivery }) {
  const router = useRouter();
  const [status, setStatus] = useState<DeliveryStatus>(delivery.status);
  const [notes, setNotes] = useState(delivery.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsNotes = status === "Failed" || status === "Returned";
  const isUnchanged = status === delivery.status && notes === (delivery.notes ?? "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateDeliveryStatus(delivery.id, {
        status,
        notes: needsNotes ? notes : undefined,
      });
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update this delivery."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground">Update status</p>
      <Select value={status} onValueChange={(value) => setStatus((value as DeliveryStatus) ?? status)}>
        <SelectTrigger aria-label="Update delivery status">
          <SelectValue>{(value: DeliveryStatus) => value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {needsNotes && (
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="What happened?"
          className="min-h-16 resize-none"
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="button"
        size="sm"
        className="self-end"
        onClick={handleSave}
        disabled={saving || isUnchanged || (needsNotes && !notes.trim())}
      >
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
