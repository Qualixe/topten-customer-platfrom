"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Search } from "lucide-react";

import { FormField } from "@/components/dashboard/form-field";
import { GiftPickerField } from "@/components/dashboard/gifts/gift-picker-field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { listCustomers, type Customer } from "@/lib/api/customers";
import {
  createGiftOrder,
  GIFT_OCCASION_LABELS,
  type GiftItem,
  type GiftOccasion,
} from "@/lib/api/gifts";
import { getErrorMessage } from "@/lib/api/types";

const SEARCH_DEBOUNCE_MS = 400;

export function SendGiftForm({ catalog }: { catalog: GiftItem[] }) {
  const router = useRouter();

  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [catalogItemId, setCatalogItemId] = useState("");
  const [occasion, setOccasion] = useState<GiftOccasion>("BIRTHDAY");

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

    if (!debouncedSearch.trim()) {
      Promise.resolve().then(() => {
        if (!cancelled) setCustomers([]);
      });
      return () => {
        cancelled = true;
      };
    }

    Promise.resolve()
      .then(async () => {
        setSearching(true);
        try {
          const result = await listCustomers({ search: debouncedSearch, pageSize: 8 });
          if (!cancelled) setCustomers(result.items);
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
    if (!selectedCustomer || !catalogItemId) return;

    setSubmitting(true);
    setError(null);
    try {
      await createGiftOrder({
        customerId: selectedCustomer.id,
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
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Gift details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormField htmlFor="send-gift-customer" label="Customer">
            {selectedCustomer ? (
              <div className="flex items-center gap-3 rounded-lg border p-2">
                <Avatar size="sm">
                  <AvatarFallback>{selectedCustomer.initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{selectedCustomer.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedCustomer.phone}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCustomer(null)}
                >
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
                    id="send-gift-customer"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Search by name, email, or phone…"
                    className="pl-8"
                  />
                </div>
                {debouncedSearch.trim() && (
                  <div className="flex max-h-48 flex-col divide-y overflow-y-auto rounded-lg border">
                    {searching && (
                      <p className="p-3 text-center text-sm text-muted-foreground">Searching…</p>
                    )}
                    {!searching && customers.length === 0 && (
                      <p className="p-3 text-center text-sm text-muted-foreground">
                        No customers found.
                      </p>
                    )}
                    {!searching &&
                      customers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => setSelectedCustomer(customer)}
                          className={cn(
                            "flex w-full items-center gap-3 p-2 text-left transition-colors hover:bg-muted/50"
                          )}
                        >
                          <Avatar size="sm">
                            <AvatarFallback>{customer.initials}</AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {customer.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {customer.phone}
                            </span>
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </FormField>

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
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="outline" nativeButton={false} render={<Link href="/dashboard/gifts" />}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !selectedCustomer || !catalogItemId}>
            {submitting ? (
              "Queuing…"
            ) : (
              <>
                <Check /> Queue Gift
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
