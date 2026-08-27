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

/** Search + customer type filters for the Verified Customers page. The
 * campaign filter lives in its own dropdown next to this toolbar (see the
 * page) since it needs the list of campaigns fetched server-side. */
export function VerifiedCustomersToolbar() {
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
    router.push(`/dashboard/customers/verified?${params.toString()}`);
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
          aria-label="Search verified customers"
        />
      </form>

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
    </div>
  );
}
