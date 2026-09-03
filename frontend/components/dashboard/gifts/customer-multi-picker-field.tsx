"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Search, Users } from "lucide-react";

import { CustomerTypeBadge } from "@/components/dashboard/customers/customer-type-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { listCustomerTypes, type CustomerTypeOption } from "@/lib/api/customer-types";
import { listCustomers, type Customer } from "@/lib/api/customers";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

/** Multi-select counterpart to GiftPickerField: opens a searchable,
 * checkable list of customers (loaded browsable, not empty until you
 * type) instead of a single-pick dropdown, so a gift can be queued for
 * several recipients at once. Only offers verified customers
 * (`verified: true`, see `list_customers` in
 * app/controllers/customers.py — verified through at least one
 * campaign's profile form) — unverified customers don't show up here. */
export function CustomerMultiPickerField({
  selected,
  onChange,
}: {
  selected: Customer[];
  onChange: (customers: Customer[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [customerTypeId, setCustomerTypeId] = useState("all");
  const [types, setTypes] = useState<CustomerTypeOption[]>([]);
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIds = new Set(selected.map((customer) => customer.id));

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    if (!open) return;
    listCustomerTypes()
      .then(setTypes)
      .catch(() => {
        // Non-fatal — the filter just shows "All Types" only.
      });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    Promise.resolve()
      .then(async () => {
        setLoading(true);
        try {
          const result = await listCustomers({
            search: debouncedSearch.trim() || undefined,
            customerTypeId,
            pageSize: PAGE_SIZE,
            verified: true,
          });
          if (!cancelled) setResults(result.items);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, debouncedSearch, customerTypeId]);

  function toggle(customer: Customer) {
    if (selectedIds.has(customer.id)) {
      onChange(selected.filter((item) => item.id !== customer.id));
    } else {
      onChange([...selected, customer]);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors hover:bg-muted/50",
              selected.length === 0 && "justify-center border-dashed py-6 text-muted-foreground"
            )}
          />
        }
      >
        {selected.length > 0 ? (
          <>
            <div className="flex -space-x-2">
              {selected.slice(0, 4).map((customer) => (
                <Avatar key={customer.id} size="sm" className="ring-2 ring-background">
                  <AvatarFallback>{customer.initials}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="min-w-0 flex-1 text-sm font-medium">
              {selected.length} customer{selected.length === 1 ? "" : "s"} selected
            </span>
            <span className="shrink-0 text-xs font-medium text-primary">Change</span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1.5">
            <Users className="size-6" aria-hidden="true" />
            <span className="text-sm font-medium">Select customers</span>
          </span>
        )}
      </DialogTrigger>

      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select customers</DialogTitle>
          <DialogDescription>
            Choose everyone this gift is for — only verified customers (completed a
            campaign&apos;s profile form) are shown. You can add or remove recipients any time
            before queueing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, or phone…"
              className="pl-8"
              autoFocus
            />
          </div>
          <Select value={customerTypeId} onValueChange={(value) => setCustomerTypeId(value ?? "all")}>
            <SelectTrigger className="w-36" aria-label="Filter by customer type">
              <SelectValue>
                {(value: string) =>
                  value === "all" ? "All Types" : (types.find((t) => t.id === value)?.name ?? "…")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {types.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col divide-y overflow-y-auto rounded-lg border">
          {loading && <p className="p-4 text-center text-sm text-muted-foreground">Searching…</p>}
          {!loading && results.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">No customers found.</p>
          )}
          {!loading &&
            results.map((customer) => {
              const isSelected = selectedIds.has(customer.id);
              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => toggle(customer)}
                  className={cn(
                    "flex w-full items-center gap-3 p-2.5 text-left transition-colors hover:bg-muted/50",
                    isSelected && "bg-primary/5"
                  )}
                >
                  <Avatar size="sm">
                    <AvatarFallback>{customer.initials}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{customer.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {customer.phone}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {customer.address || "No address on file"}
                    </span>
                  </span>
                  {customer.customerType && (
                    <span className="shrink-0">
                      <CustomerTypeBadge customerType={customer.customerType} />
                    </span>
                  )}
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30"
                    )}
                  >
                    {isSelected && <Check className="size-3" aria-hidden="true" />}
                  </span>
                </button>
              );
            })}
        </div>

        <DialogFooter className="shrink-0">
          <Button type="button" onClick={() => setOpen(false)}>
            Done{selected.length > 0 ? ` (${selected.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
