"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormField } from "@/components/dashboard/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { updateGiftOrderStatus, type GiftOrder } from "@/lib/api/gifts";
import { getErrorMessage } from "@/lib/api/types";

const TODAY = new Date().toISOString().slice(0, 10);

export function ScheduleGiftDialog({
  order,
  open,
  onOpenChange,
}: {
  order: GiftOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {order && (
          <ScheduleGiftForm key={order.id} order={order} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ScheduleGiftForm({ order, onClose }: { order: GiftOrder; onClose: () => void }) {
  const router = useRouter();
  const [scheduledFor, setScheduledFor] = useState(order.scheduledFor ?? TODAY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await updateGiftOrderStatus(order.id, { status: "SCHEDULED", scheduledFor });
      router.refresh();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to reach the API server. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Schedule Gift</DialogTitle>
        <DialogDescription>
          Pick a date to send {order.giftName} to {order.customerName}.
        </DialogDescription>
      </DialogHeader>

      <FormField htmlFor="schedule-gift-date" label="Scheduled date">
        <Input
          id="schedule-gift-date"
          type="date"
          min={TODAY}
          value={scheduledFor}
          onChange={(event) => setScheduledFor(event.target.value)}
          required
        />
      </FormField>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter showCloseButton>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Schedule"}
        </Button>
      </DialogFooter>
    </form>
  );
}
