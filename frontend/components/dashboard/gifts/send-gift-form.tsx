"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Check, Gift as GiftIcon, MapPin, Sparkles, X } from "lucide-react";

import { CustomerTierBadge } from "@/components/dashboard/customers/tier-badge";
import { FormField } from "@/components/dashboard/form-field";
import { CustomerMultiPickerField } from "@/components/dashboard/gifts/customer-multi-picker-field";
import { GiftPickerField } from "@/components/dashboard/gifts/gift-picker-field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { Customer } from "@/lib/api/customers";
import {
  createGiftOrdersBulk,
  formatCurrency,
  GIFT_OCCASION_LABELS,
  resolveGiftImageUrl,
  type GiftItem,
  type GiftOccasion,
} from "@/lib/api/gifts";
import { getErrorMessage } from "@/lib/api/types";
import { getGiftCategoryVisual } from "@/lib/gift-category-visuals";
import { cn } from "@/lib/utils";

export function SendGiftForm({ catalog }: { catalog: GiftItem[] }) {
  const router = useRouter();

  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([]);
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [catalogItemId, setCatalogItemId] = useState("");
  const [occasion, setOccasion] = useState<GiftOccasion>("BIRTHDAY");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedGift = catalog.find((item) => item.id === catalogItemId) ?? null;
  const giftVisual = selectedGift ? getGiftCategoryVisual(selectedGift.category.name) : null;
  const giftImageUrl = selectedGift ? resolveGiftImageUrl(selectedGift.imageUrl) : null;
  const GiftVisualIcon = giftVisual?.icon;
  const canSubmit = selectedCustomers.length > 0 && Boolean(catalogItemId);

  function handleCustomersChange(next: Customer[]) {
    setSelectedCustomers(next);
    // A customer's address defaults to what's already on file, and stays
    // as whatever the admin typed if they're removed and re-added within
    // the same session — only a customer with no prior address here gets
    // re-defaulted (to "", since they still have none).
    setAddresses((prev) => {
      const updated: Record<string, string> = {};
      for (const customer of next) {
        updated[customer.id] = prev[customer.id] ?? customer.address ?? "";
      }
      return updated;
    });
  }

  function handleRemoveCustomer(customerId: string) {
    handleCustomersChange(selectedCustomers.filter((customer) => customer.id !== customerId));
  }

  function handleAddressChange(customerId: string, value: string) {
    setAddresses((prev) => ({ ...prev, [customerId]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedCustomers.length === 0 || !catalogItemId) return;

    setSubmitting(true);
    setError(null);
    try {
      await createGiftOrdersBulk({
        recipients: selectedCustomers.map((customer) => ({
          customerId: customer.id,
          deliveryAddress: addresses[customer.id],
        })),
        catalogItemId,
        occasion,
      });
      router.push("/dashboard/gifts");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to reach the API server. Please try again."));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader>
          <CardTitle>Gift details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FormField htmlFor="send-gift-customers" label="Customers">
            <CustomerMultiPickerField
              selected={selectedCustomers}
              onChange={handleCustomersChange}
            />
          </FormField>

          {selectedCustomers.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border p-2">
              {selectedCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex flex-col gap-2 rounded-md p-1.5 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:w-48 sm:flex-none">
                    <Avatar size="sm">
                      <AvatarFallback>{customer.initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium">{customer.name}</p>
                        {customer.tier === "VIP" && <CustomerTierBadge tier={customer.tier} />}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{customer.phone}</p>
                    </div>
                  </div>
                  <div className="relative min-w-0 flex-1">
                    <MapPin
                      className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      value={addresses[customer.id] ?? ""}
                      onChange={(event) => handleAddressChange(customer.id, event.target.value)}
                      placeholder="Delivery address (optional)"
                      className="h-8 pl-8 text-sm"
                      aria-label={`Delivery address for ${customer.name}`}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${customer.name}`}
                    onClick={() => handleRemoveCustomer(customer.id)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <FormField htmlFor="send-gift-item" label="Gift">
            <GiftPickerField catalog={catalog} value={catalogItemId} onChange={setCatalogItemId} />
          </FormField>

          <FormField htmlFor="send-gift-occasion" label="Occasion">
            <Select
              value={occasion}
              onValueChange={(value) => setOccasion((value as GiftOccasion) ?? "BIRTHDAY")}
            >
              <SelectTrigger id="send-gift-occasion">
                <SelectValue>{(value: GiftOccasion) => GIFT_OCCASION_LABELS[value]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(GIFT_OCCASION_LABELS) as [GiftOccasion, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </FormField>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card className="lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {selectedCustomers.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                {selectedCustomers.length} recipient{selectedCustomers.length === 1 ? "" : "s"}
              </p>
              <div className="flex max-h-32 flex-col gap-1.5 overflow-y-auto">
                {selectedCustomers.map((customer) => (
                  <div key={customer.id} className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarFallback>{customer.initials}</AvatarFallback>
                    </Avatar>
                    <p className="truncate text-xs text-muted-foreground">{customer.name}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No customers selected yet.</p>
          )}

          <Separator />

          {selectedGift ? (
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md",
                  !giftImageUrl && (giftVisual?.tileClassName ?? "bg-muted")
                )}
              >
                {giftImageUrl ? (
                  <Image src={giftImageUrl} alt="" fill unoptimized className="object-cover" />
                ) : GiftVisualIcon ? (
                  <GiftVisualIcon
                    className={cn("size-5", giftVisual?.iconClassName)}
                    aria-hidden="true"
                  />
                ) : (
                  <GiftIcon className="size-5 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{selectedGift.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {selectedGift.category.name}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold">
                {formatCurrency(selectedGift.retailValue)}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No gift selected yet.</p>
          )}

          {selectedGift && selectedCustomers.length > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total value</span>
              <span className="font-semibold">
                {formatCurrency(selectedGift.retailValue * selectedCustomers.length)}
              </span>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Occasion</span>
            <Badge variant="outline">{GIFT_OCCASION_LABELS[occasion]}</Badge>
          </div>

          <p className="text-xs text-muted-foreground">
            This queues one order per customer — nothing is sent until you schedule or send it
            from the Gifts page.
          </p>

          <div className="flex flex-col gap-2 pt-1">
            <Button type="submit" disabled={submitting || !canSubmit}>
              {submitting ? (
                "Queuing…"
              ) : (
                <>
                  <Check />
                  Queue Gift{selectedCustomers.length > 1 ? "s" : ""}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={<Link href="/dashboard/gifts" />}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
