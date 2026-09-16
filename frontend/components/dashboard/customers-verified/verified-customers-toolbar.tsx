"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxSearchInput,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listCustomerTypes, type CustomerTypeOption } from "@/lib/api/customer-types";
import { BD_DISTRICTS } from "@/lib/bd-districts";
import { SPEND_RANGES } from "@/lib/spend-ranges";

const CITY_FILTER_ITEMS = ["all", ...BD_DISTRICTS];

const STATUS_LABELS: Record<string, string> = {
  all: "Statuses",
  Active: "Active",
  Inactive: "Inactive",
  Suspended: "Suspended",
};

/** Search + Status/Type/City/Spend filters for the Verified Customers page
 * — the same filter set as the main Customers page (see
 * customers-toolbar.tsx). The campaign filter lives in its own dropdown
 * next to this toolbar (see the page) since it needs the list of campaigns
 * fetched server-side. */
export function VerifiedCustomersToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [types, setTypes] = useState<CustomerTypeOption[]>([]);

  useEffect(() => {
    listCustomerTypes()
      .then(setTypes)
      .catch(() => {
        // Non-fatal — the filter just shows "Types" only.
      });
  }, []);

  function navigate(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value && value !== "all") params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.push(`/dashboard/customers/verified?${params.toString()}`);
  }

  const cityValue = searchParams.get("city") ?? "all";
  const spendValue = searchParams.get("spendRange") ?? "all";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form
        className="relative flex-1 sm:max-w-sm"
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ search });
        }}
      >
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or phone…"
          className="pl-8"
          aria-label="Search verified customers"
        />
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={searchParams.get("status") ?? "all"}
          onValueChange={(value) => navigate({ status: value ?? "all" })}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by status">
            <SelectValue>{(value: string) => STATUS_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
            <SelectItem value="Suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("customerTypeId") ?? "all"}
          onValueChange={(value) => navigate({ customerTypeId: value ?? "all" })}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by customer type">
            <SelectValue>
              {(value: string) =>
                value === "all" ? "Types" : (types.find((t) => t.id === value)?.name ?? "…")
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

        <Combobox
          items={CITY_FILTER_ITEMS}
          value={cityValue}
          onValueChange={(value) => navigate({ city: (value as string) ?? "all" })}
        >
          <ComboboxTrigger className="w-full sm:w-36" aria-label="Filter by city">
            <ComboboxValue>{(value: string) => (value === "all" ? "Cities" : value)}</ComboboxValue>
          </ComboboxTrigger>
          <ComboboxContent>
            <ComboboxSearchInput placeholder="Search districts…" />
            <ComboboxEmpty>No district found.</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item}>
                  {item === "all" ? "All Cities" : item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>

        <Select
          value={spendValue}
          onValueChange={(value) => navigate({ spendRange: value ?? "all" })}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by spend range">
            <SelectValue>
              {(value: string) =>
                value === "all"
                  ? "Spend"
                  : (SPEND_RANGES.find((range) => range.key === value)?.label ?? "…")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Spend</SelectItem>
            {SPEND_RANGES.map((range) => (
              <SelectItem key={range.key} value={range.key}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
