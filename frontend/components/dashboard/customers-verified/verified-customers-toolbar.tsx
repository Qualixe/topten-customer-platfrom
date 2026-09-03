"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listCustomerTypes, type CustomerTypeOption } from "@/lib/api/customer-types";

/** Search + customer type filters for the Verified Customers page. The
 * campaign filter lives in its own dropdown next to this toolbar (see the
 * page) since it needs the list of campaigns fetched server-side. */
export function VerifiedCustomersToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [types, setTypes] = useState<CustomerTypeOption[]>([]);

  useEffect(() => {
    listCustomerTypes()
      .then(setTypes)
      .catch(() => {
        // Non-fatal — the filter just shows "All Types" only.
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
        value={searchParams.get("customerTypeId") ?? "all"}
        onValueChange={(value) => navigate({ customerTypeId: value ?? "all" })}
      >
        <SelectTrigger className="w-full sm:w-40" aria-label="Filter by customer type">
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
  );
}
