"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Search } from "lucide-react";

import { PaginationBar } from "@/components/dashboard/customers/pagination-bar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { listCustomers, type Customer } from "@/lib/api/customers";

const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 10;

interface CustomerPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Already-confirmed picks — the dialog seeds its working selection from
   * these each time it opens, and discards unconfirmed changes on cancel. */
  selected: Customer[];
  onConfirm: (customers: Customer[]) => void;
}

export function CustomerPickerDialog({
  open,
  onOpenChange,
  selected,
  onConfirm,
}: CustomerPickerDialogProps) {
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  // Keyed by id so a pick made on one search/page survives navigating to
  // another — `customers` only ever holds the current page's rows.
  const [pickedMap, setPickedMap] = useState<Map<string, Customer>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-seed the working selection from the confirmed picks every time the
  // dialog opens, so a cancelled session never leaks into the next one.
  // setState is routed through a resolved promise (never called
  // synchronously at the top of the effect) per this codebase's
  // react-hooks/set-state-in-effect fix pattern.
  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => {
      setPickedMap(new Map(selected.map((customer) => [customer.id, customer])));
      setSearchValue("");
      setDebouncedSearch("");
      setPage(1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchValue);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchValue]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    Promise.resolve()
      .then(async () => {
        setLoading(true);
        try {
          const result = await listCustomers({
            search: debouncedSearch,
            page,
            pageSize: PAGE_SIZE,
          });
          if (cancelled) return;
          setCustomers(result.items);
          setTotal(result.total);
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
  }, [open, debouncedSearch, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggle(customer: Customer) {
    setPickedMap((prev) => {
      const next = new Map(prev);
      if (next.has(customer.id)) next.delete(customer.id);
      else next.set(customer.id, customer);
      return next;
    });
  }

  function handleConfirm() {
    onConfirm([...pickedMap.values()]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose customers</DialogTitle>
          <DialogDescription>
            Search and select the individual customers who should receive
            this campaign.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search by name, email, or phone…"
            className="pl-8"
            aria-label="Search customers"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {pickedMap.size} customer{pickedMap.size === 1 ? "" : "s"} selected
        </p>

        <ScrollArea className="h-72 rounded-lg border">
          <div className="flex flex-col divide-y">
            {loading && (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            )}
            {!loading && customers.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No customers found.
              </p>
            )}
            {!loading &&
              customers.map((customer) => {
                const isPicked = pickedMap.has(customer.id);
                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => toggle(customer)}
                    aria-pressed={isPicked}
                    className={cn(
                      "flex w-full items-center gap-3 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      isPicked ? "bg-primary/5" : "hover:bg-muted/50"
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
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border",
                        isPicked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      )}
                    >
                      {isPicked && <Check className="size-3" aria-hidden="true" />}
                    </span>
                  </button>
                );
              })}
          </div>
        </ScrollArea>

        <PaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            {pickedMap.size > 0 ? `Add ${pickedMap.size}` : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
