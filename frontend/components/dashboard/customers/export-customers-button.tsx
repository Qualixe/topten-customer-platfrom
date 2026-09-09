"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CustomersUrlParams } from "@/components/dashboard/customers/customers-url";
import { exportCustomersCsv } from "@/lib/api/customers";
import { ApiError } from "@/lib/api/types";
import { SPEND_RANGES } from "@/lib/spend-ranges";

export function ExportCustomersButton({ filters }: { filters: CustomersUrlParams }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setPending(true);
    setError(null);
    try {
      // `filters.spendRange` is a bucket key, not the min/max
      // exportCustomersCsv actually sends — resolve it here so the export
      // matches the same rows the on-screen table is currently filtered
      // to (same reasoning as CustomersResults).
      const spendRange = SPEND_RANGES.find((range) => range.key === filters.spendRange);
      await exportCustomersCsv({
        ...filters,
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
