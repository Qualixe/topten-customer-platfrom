"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Search, Tag, Users } from "lucide-react";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listCustomerTypes, type CustomerTypeOption } from "@/lib/api/customer-types";
import { listCustomers, type Customer } from "@/lib/api/customers";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;
// The backend caps page_size at 100 (GET /customers), so a type with more
// customers than fit on one page needs a few follow-up requests — capped
// here at 500 total so selecting a huge type (e.g. "General") can't balloon
// into thousands of gift orders from one click.
const TYPE_FETCH_PAGE_SIZE = 100;
const TYPE_FETCH_MAX_CUSTOMERS = 500;

type SelectionMode = "type" | "specific";

/** Multi-select counterpart to GiftPickerField: opens a dialog that lets
 * the user either pick all customers of a given type (By Customer Type)
 * or hand-pick individual verified customers (Specific Customers). */
export function CustomerMultiPickerField({
  selected,
  onChange,
}: {
  selected: Customer[];
  onChange: (customers: Customer[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SelectionMode>("type");

  // ── By Customer Type state ────────────────────────────────────────────
  const [types, setTypes] = useState<CustomerTypeOption[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [typeCustomers, setTypeCustomers] = useState<Customer[]>([]);
  const [typeCustomersTotal, setTypeCustomersTotal] = useState(0);
  const [typeLoading, setTypeLoading] = useState(false);

  // ── Specific Customers state ──────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIds = new Set(selected.map((c) => c.id));

  // Load customer types when dialog opens
  useEffect(() => {
    if (!open) return;
    listCustomerTypes()
      .then((all) => setTypes(all.filter((t) => t.isActive)))
      .catch(() => {});
  }, [open]);

  // Fetch all customers for the selected type. The backend caps page_size
  // at 100, so this pages through as many requests as needed to reach
  // either the real total or TYPE_FETCH_MAX_CUSTOMERS, whichever is first.
  useEffect(() => {
    let cancelled = false;

    Promise.resolve()
      .then(async () => {
        if (!open || mode !== "type" || !selectedTypeId) {
          setTypeCustomers([]);
          setTypeCustomersTotal(0);
          return;
        }

        setTypeLoading(true);
        const collected: Customer[] = [];
        let total = 0;
        let page = 1;
        for (;;) {
          const result = await listCustomers({
            customerTypeId: selectedTypeId,
            page,
            pageSize: TYPE_FETCH_PAGE_SIZE,
          });
          total = result.total;
          collected.push(...result.items);
          if (
            collected.length >= total ||
            collected.length >= TYPE_FETCH_MAX_CUSTOMERS ||
            result.items.length === 0
          ) {
            break;
          }
          page += 1;
        }
        if (!cancelled) {
          setTypeCustomers(collected);
          setTypeCustomersTotal(total);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTypeCustomers([]);
          setTypeCustomersTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setTypeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, mode, selectedTypeId]);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Fetch specific customers
  useEffect(() => {
    if (!open || mode !== "specific") return;
    let cancelled = false;
    Promise.resolve()
      .then(async () => {
        setSearchLoading(true);
        try {
          const result = await listCustomers({
            search: debouncedSearch.trim() || undefined,
            pageSize: PAGE_SIZE,
            verified: true,
          });
          if (!cancelled) setResults(result.items);
        } finally {
          if (!cancelled) setSearchLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode, debouncedSearch]);

  function toggleSpecific(customer: Customer) {
    if (selectedIds.has(customer.id)) {
      onChange(selected.filter((c) => c.id !== customer.id));
    } else {
      onChange([...selected, customer]);
    }
  }

  function selectAllOfType() {
    // Merge type customers into selection, avoiding duplicates
    const newIds = new Set(typeCustomers.map((c) => c.id));
    const kept = selected.filter((c) => !newIds.has(c.id));
    onChange([...kept, ...typeCustomers]);
    setOpen(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setSearch("");
      setSelectedTypeId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            Choose recipients by customer type or pick individuals.
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as SelectionMode)}
          className="shrink-0"
        >
          <TabsList className="w-full">
            <TabsTrigger value="type" className="flex-1 gap-2">
              <Tag className="size-3.5" aria-hidden="true" />
              By Customer Type
            </TabsTrigger>
            <TabsTrigger value="specific" className="flex-1 gap-2">
              <Users className="size-3.5" aria-hidden="true" />
              Specific Customers
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ── By Customer Type ── */}
        {mode === "type" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {types.map((type) => {
                const isSelected = selectedTypeId === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedTypeId(isSelected ? null : type.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    )}
                  >
                    <Tag
                      className={cn(
                        "size-4 shrink-0",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate font-medium">{type.name}</span>
                  </button>
                );
              })}
            </div>

            {selectedTypeId && (
              <div className="flex flex-col gap-2 rounded-lg border p-3">
                {typeLoading ? (
                  <p className="text-center text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <>
                    <p className="text-sm font-medium">
                      {typeCustomers.length} customer{typeCustomers.length === 1 ? "" : "s"} in this type
                      {typeCustomersTotal > typeCustomers.length && (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          (of {typeCustomersTotal.toLocaleString("en-US")} — capped at{" "}
                          {TYPE_FETCH_MAX_CUSTOMERS})
                        </span>
                      )}
                    </p>
                    <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                      {typeCustomers.slice(0, 10).map((c) => (
                        <div key={c.id} className="flex items-center gap-2">
                          <Avatar size="sm">
                            <AvatarFallback>{c.initials}</AvatarFallback>
                          </Avatar>
                          <span className="truncate text-xs text-muted-foreground">{c.name}</span>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{c.phone}</span>
                        </div>
                      ))}
                      {typeCustomers.length > 10 && (
                        <p className="text-center text-xs text-muted-foreground">
                          +{typeCustomers.length - 10} more
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <DialogFooter className="shrink-0">
              <Button
                type="button"
                disabled={!selectedTypeId || typeLoading || typeCustomers.length === 0}
                onClick={selectAllOfType}
              >
                Select All ({typeCustomers.length})
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Specific Customers ── */}
        {mode === "specific" && (
          <>
            <div className="relative shrink-0">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or phone…"
                className="pl-8"
                autoFocus
              />
            </div>

            <div className="flex flex-col divide-y overflow-y-auto rounded-lg border">
              {searchLoading && (
                <p className="p-4 text-center text-sm text-muted-foreground">Searching…</p>
              )}
              {!searchLoading && results.length === 0 && (
                <p className="p-4 text-center text-sm text-muted-foreground">No customers found.</p>
              )}
              {!searchLoading &&
                results.map((customer) => {
                  const isSelected = selectedIds.has(customer.id);
                  return (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => toggleSpecific(customer)}
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
