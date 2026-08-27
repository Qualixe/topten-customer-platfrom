"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  all: "All Types",
  GENERAL: "General",
  VIP: "VIP",
  VVIP: "VVIP",
};

const PROFILE_STATUS_LABELS: Record<string, string> = {
  all: "All Profiles",
  COMPLETE: "Complete",
  INCOMPLETE: "Incomplete",
};

/** Search + customer type + profile status filters for the POS Customers
 * page. Reads/writes the URL's search params directly — the page itself
 * (a Server Component) re-fetches whenever those change. */
export function PosCustomersToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  function navigate(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value && value !== "all") params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.push(`/dashboard/customers/pos?${params.toString()}`);
  }

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
          aria-label="Search customers"
        />
      </form>

      <div className="flex items-center gap-2">
        <Select
          value={searchParams.get("customerType") ?? "all"}
          onValueChange={(value) => navigate({ customerType: value ?? "all" })}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by customer type">
            <SelectValue>{(value: string) => CUSTOMER_TYPE_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CUSTOMER_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("profileStatus") ?? "all"}
          onValueChange={(value) => navigate({ profileStatus: value ?? "all" })}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by profile status">
            <SelectValue>{(value: string) => PROFILE_STATUS_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PROFILE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
