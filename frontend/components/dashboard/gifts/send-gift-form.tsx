"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Cake, Check, Gift as GiftIcon, MapPin, Sparkles, Truck, X } from "lucide-react";

import { CustomerTierBadge } from "@/components/dashboard/customers/tier-badge";
import {
  EMPTY_PATHAO_LOCATION,
  MIN_PATHAO_ADDRESS_LENGTH,
  PathaoLocationPicker,
  type PathaoLocationValue,
} from "@/components/dashboard/couriers/pathao-location-picker";
import { FormField } from "@/components/dashboard/form-field";
import { CustomerMultiPickerField } from "@/components/dashboard/gifts/customer-multi-picker-field";
import { GiftPickerField } from "@/components/dashboard/gifts/gift-picker-field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/lib/api/customers";
import type { CourierProvider } from "@/lib/api/deliveries";
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

interface RecipientDetails {
  address: string;
  wishText: string;
  shipViaCourier: boolean;
  courier: CourierProvider;
  dispatchMode: "manual" | "pathao";
  trackingNumber: string;
  city: string;
  pathaoLocation: PathaoLocationValue;
  recipientName: string;
  recipientPhone: string;
}

function defaultDetails(customer: Customer): RecipientDetails {
  return {
    address: customer.address ?? "",
    wishText: "",
    shipViaCourier: false,
    courier: "Pathao",
    dispatchMode: "pathao",
    trackingNumber: "",
    city: "",
    pathaoLocation: EMPTY_PATHAO_LOCATION,
    recipientName: customer.name,
    recipientPhone: customer.phone,
  };
}

/** "YYYY-MM-DD" -> "Jan 15, 1990" — unlike the Birthdays page's month/day-
 * only convention (built for recurring reminders), this is a one-time
 * reference shown while writing a wish, so the year is worth keeping. */
function formatDob(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function SendGiftForm({ catalog }: { catalog: GiftItem[] }) {
  const router = useRouter();

  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([]);
  const [details, setDetails] = useState<Record<string, RecipientDetails>>({});
  const [catalogItemId, setCatalogItemId] = useState("");
  const [occasion, setOccasion] = useState<GiftOccasion>("BIRTHDAY");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedGift = catalog.find((item) => item.id === catalogItemId) ?? null;
  const giftVisual = selectedGift ? getGiftCategoryVisual(selectedGift.category.name) : null;
  const giftImageUrl = selectedGift ? resolveGiftImageUrl(selectedGift.imageUrl) : null;
  const GiftVisualIcon = giftVisual?.icon;
  const hasInvalidLiveDispatchAddress = selectedCustomers.some((customer) => {
    const recipient = details[customer.id];
    if (!recipient?.shipViaCourier || recipient.courier !== "Pathao") return false;
    if (recipient.dispatchMode !== "pathao") return false;
    return recipient.address.trim().length < MIN_PATHAO_ADDRESS_LENGTH;
  });
  const canSubmit =
    selectedCustomers.length > 0 && Boolean(catalogItemId) && !hasInvalidLiveDispatchAddress;

  function handleCustomersChange(next: Customer[]) {
    setSelectedCustomers(next);
    // A customer's address defaults to what's already on file, and stays
    // as whatever the admin already typed if they're removed and re-added
    // within the same session.
    setDetails((prev) => {
      const updated: Record<string, RecipientDetails> = {};
      for (const customer of next) {
        updated[customer.id] = prev[customer.id] ?? defaultDetails(customer);
      }
      return updated;
    });
  }

  function handleRemoveCustomer(customerId: string) {
    handleCustomersChange(selectedCustomers.filter((customer) => customer.id !== customerId));
  }

  function updateDetails(customerId: string, patch: Partial<RecipientDetails>) {
    setDetails((prev) => ({ ...prev, [customerId]: { ...prev[customerId], ...patch } }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedCustomers.length === 0 || !catalogItemId) return;

    setSubmitting(true);
    setError(null);
    try {
      await createGiftOrdersBulk({
        recipients: selectedCustomers.map((customer) => {
          const recipient = details[customer.id];
          const isLiveDispatch =
            recipient.shipViaCourier &&
            recipient.courier === "Pathao" &&
            recipient.dispatchMode === "pathao";
          return {
            customerId: customer.id,
            deliveryAddress: recipient.address,
            wishText: recipient.wishText,
            ...(recipient.shipViaCourier
              ? {
                  courier: recipient.courier,
                  city: isLiveDispatch ? (recipient.pathaoLocation.cityName ?? "") : recipient.city,
                  ...(isLiveDispatch
                    ? {
                        pathaoCityId: recipient.pathaoLocation.cityId ?? undefined,
                        pathaoZoneId: recipient.pathaoLocation.zoneId ?? undefined,
                        pathaoAreaId: recipient.pathaoLocation.areaId ?? undefined,
                        recipientName: recipient.recipientName,
                        recipientPhone: recipient.recipientPhone,
                      }
                    : { trackingNumber: recipient.trackingNumber }),
                }
              : {}),
          };
        }),
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
            <div className="flex flex-col gap-3">
              {selectedCustomers.map((customer) => {
                const recipient = details[customer.id];
                if (!recipient) return null;
                return (
                  <div key={customer.id} className="flex flex-col gap-3 rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar size="sm">
                          <AvatarFallback>{customer.initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-medium">{customer.name}</p>
                            {customer.tier === "VIP" && (
                              <CustomerTierBadge tier={customer.tier} />
                            )}
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {customer.phone}
                            </span>
                          </div>
                          {customer.dateOfBirth && (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Cake className="size-3" aria-hidden="true" />
                              {formatDob(customer.dateOfBirth)}
                            </p>
                          )}
                        </div>
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

                    <div className="relative">
                      <MapPin
                        className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Textarea
                        value={recipient.address}
                        onChange={(event) =>
                          updateDetails(customer.id, { address: event.target.value })
                        }
                        placeholder="Delivery address (optional)"
                        className="min-h-16 pl-8 text-sm"
                        aria-label={`Delivery address for ${customer.name}`}
                      />
                    </div>
                    {recipient.shipViaCourier &&
                      recipient.courier === "Pathao" &&
                      recipient.dispatchMode === "pathao" &&
                      recipient.address.trim().length > 0 &&
                      recipient.address.trim().length < MIN_PATHAO_ADDRESS_LENGTH && (
                        <p className="text-xs text-destructive">
                          Pathao requires at least {MIN_PATHAO_ADDRESS_LENGTH} characters for the
                          address.
                        </p>
                      )}

                    <Input
                      value={recipient.wishText}
                      onChange={(event) =>
                        updateDetails(customer.id, { wishText: event.target.value })
                      }
                      placeholder="Wish text (optional) — e.g. Happy Birthday, {{customer_name}}!"
                      className="h-8 text-sm"
                      aria-label={`Wish text for ${customer.name}`}
                    />

                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={recipient.shipViaCourier}
                        onCheckedChange={(checked) =>
                          updateDetails(customer.id, { shipViaCourier: checked === true })
                        }
                      />
                      <Truck className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      Ship via courier
                    </label>

                    {recipient.shipViaCourier && (
                      <div className="flex flex-col gap-2">
                        <div
                          className={cn(
                            "grid grid-cols-1 gap-2",
                            recipient.dispatchMode !== "pathao" && "sm:grid-cols-2"
                          )}
                        >
                          <div
                            className="flex h-8 items-center rounded-md border bg-muted/40 px-2.5 text-sm"
                            aria-label={`Courier for ${customer.name}`}
                          >
                            {recipient.courier}
                          </div>
                          {recipient.dispatchMode !== "pathao" && (
                            <Input
                              value={recipient.city}
                              onChange={(event) =>
                                updateDetails(customer.id, { city: event.target.value })
                              }
                              placeholder="City"
                              className="h-8 text-sm"
                              aria-label={`City for ${customer.name}`}
                              required={recipient.shipViaCourier}
                            />
                          )}
                        </div>

                        <Tabs
                          value={recipient.dispatchMode}
                          onValueChange={(value) =>
                            updateDetails(customer.id, {
                              dispatchMode: value as "manual" | "pathao",
                            })
                          }
                        >
                          <TabsList className="h-7">
                            <TabsTrigger value="pathao" className="text-xs">
                              Dispatch via Pathao
                            </TabsTrigger>
                            <TabsTrigger value="manual" className="text-xs">
                              Enter tracking number
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>

                        {recipient.dispatchMode === "pathao" ? (
                          <div className="flex flex-col gap-2">
                            <PathaoLocationPicker
                              value={recipient.pathaoLocation}
                              onChange={(pathaoLocation) =>
                                updateDetails(customer.id, { pathaoLocation })
                              }
                            />
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <Input
                                value={recipient.recipientName}
                                onChange={(event) =>
                                  updateDetails(customer.id, { recipientName: event.target.value })
                                }
                                placeholder="Recipient name"
                                className="h-8 text-sm"
                                aria-label={`Recipient name for ${customer.name}`}
                                required
                              />
                              <Input
                                value={recipient.recipientPhone}
                                onChange={(event) =>
                                  updateDetails(customer.id, {
                                    recipientPhone: event.target.value,
                                  })
                                }
                                placeholder="Recipient phone"
                                className="h-8 text-sm"
                                aria-label={`Recipient phone for ${customer.name}`}
                                required
                              />
                            </div>
                          </div>
                        ) : (
                          <Input
                            value={recipient.trackingNumber}
                            onChange={(event) =>
                              updateDetails(customer.id, { trackingNumber: event.target.value })
                            }
                            placeholder="Tracking number"
                            className="h-8 text-sm"
                            aria-label={`Tracking number for ${customer.name}`}
                            required={recipient.shipViaCourier}
                          />
                        )}

                        {!recipient.address && (
                          <p className="text-xs text-destructive">
                            A delivery address is required to ship via courier.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
                    {details[customer.id]?.shipViaCourier && (
                      <Truck className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
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
                  <Image src={giftImageUrl} alt="" fill className="object-cover" />
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
            from the Gifts page. Recipients with courier shipping checked also get their
            delivery created right away.
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
