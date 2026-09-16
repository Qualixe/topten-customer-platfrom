"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { exportVerifiedCustomersCsv, type CustomerStatus } from "@/lib/api/customers";
import { ApiError } from "@/lib/api/types";
import { SPEND_RANGES } from "@/lib/spend-ranges";

/** Exports every verified customer matching the toolbar's current filters
 * (not just the current page) as a CSV — reads straight off the URL, same
 * filters the toolbar itself writes to it. */
export function VerifiedCustomersExportButton() {
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setPending(true);
    setError(null);
    try {
      const spendRange = SPEND_RANGES.find((range) => range.key === searchParams.get("spendRange"));
      await exportVerifiedCustomersCsv({
        search: searchParams.get("search") ?? undefined,
        campaignId: searchParams.get("campaignId") ?? undefined,
        customerTypeId: searchParams.get("customerTypeId") ?? undefined,
        status: (searchParams.get("status") as CustomerStatus | null) ?? undefined,
        city: searchParams.get("city") ?? undefined,
        minTotalSpent: spendRange?.min,
        maxTotalSpent: spendRange?.max,
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to reach the API server. Please try again."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" onClick={handleExport} disabled={pending}>
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Download aria-hidden="true" />
        )}
        Export CSV
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
