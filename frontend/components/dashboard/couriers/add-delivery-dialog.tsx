"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search, Truck } from "lucide-react";

import { FormField } from "@/components/dashboard/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COURIER_PROVIDERS,
  createDelivery,
  listEligibleGiftOrdersForDelivery,
  type CourierProvider,
  type EligibleGiftOrder,
} from "@/lib/api/deliveries";
import { getErrorMessage } from "@/lib/api/types";

const SEARCH_DEBOUNCE_MS = 400;

export function AddDeliveryDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Truck />
            Add Delivery
          </Button>
        }
      />

      <DialogContent className="flex flex-col gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Delivery</DialogTitle>
          <DialogDescription>
            Pick a gift order and courier details — this starts tracking its shipment.
          </DialogDescription>
        </DialogHeader>

        <AddDeliveryForm key={open ? "open" : "closed"} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddDeliveryForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [giftOrders, setGiftOrders] = useState<EligibleGiftOrder[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<EligibleGiftOrder | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [courier, setCourier] = useState<CourierProvider>("Pathao");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchValue), SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchValue]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(async () => {
        setSearching(true);
        try {
          const orders = await listEligibleGiftOrdersForDelivery(debouncedSearch);
          if (!cancelled) setGiftOrders(orders);
        } finally {
          if (!cancelled) setSearching(false);
        }
      })
      .catch(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrder) return;

    setSubmitting(true);
    setError(null);
    try {
      await createDelivery({
        giftOrderId: selectedOrder.id,
        courier,
        trackingNumber,
        address,
        city,
        estimatedDelivery: estimatedDelivery || undefined,
      });
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
      <FormField htmlFor="delivery-gift-order" label="Gift Order">
        {selectedOrder ? (
          <div className="flex items-center gap-3 rounded-lg border p-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{selectedOrder.customerName}</p>
              <p className="truncate text-xs text-muted-foreground">{selectedOrder.giftName}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedOrder(null)}>
              Change
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="delivery-gift-order"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search by customer name…"
                className="pl-8"
              />
            </div>
            <div className="flex max-h-48 flex-col divide-y overflow-y-auto rounded-lg border">
              {searching && (
                <p className="p-3 text-center text-sm text-muted-foreground">Searching…</p>
              )}
              {!searching && giftOrders.length === 0 && (
                <p className="p-3 text-center text-sm text-muted-foreground">
                  No eligible gift orders found.
                </p>
              )}
              {!searching &&
                giftOrders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrder(order)}
                    className="flex w-full flex-col items-start p-2 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="truncate text-sm font-medium">{order.customerName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {order.giftName}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </FormField>

      <FormField htmlFor="delivery-courier" label="Courier">
        <Select value={courier} onValueChange={(value) => setCourier((value as CourierProvider) ?? "Pathao")}>
          <SelectTrigger id="delivery-courier">
            <SelectValue>{(value: CourierProvider) => value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {COURIER_PROVIDERS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField htmlFor="delivery-tracking" label="Tracking Number">
        <Input
          id="delivery-tracking"
          value={trackingNumber}
          onChange={(event) => setTrackingNumber(event.target.value)}
          placeholder="e.g. PTH-2026001"
          required
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField htmlFor="delivery-address" label="Address">
          <Input
            id="delivery-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="House, road, area"
            required
          />
        </FormField>

        <FormField htmlFor="delivery-city" label="City">
          <Input
            id="delivery-city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="e.g. Dhaka"
            required
          />
        </FormField>
      </div>

      <FormField htmlFor="delivery-estimated" label="Estimated Delivery (optional)">
        <Input
          id="delivery-estimated"
          type="date"
          value={estimatedDelivery}
          onChange={(event) => setEstimatedDelivery(event.target.value)}
        />
      </FormField>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter showCloseButton>
        <Button
          type="submit"
          disabled={submitting || !selectedOrder || !trackingNumber || !address || !city}
        >
          {submitting ? "Adding…" : "Add Delivery"}
        </Button>
      </DialogFooter>
    </form>
  );
}
