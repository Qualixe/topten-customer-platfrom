"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CustomersUrlParams } from "@/components/dashboard/customers/customers-url";
import { exportCustomersCsv } from "@/lib/api/customers";
import { ApiError } from "@/lib/api/types";

export function ExportCustomersButton({ filters }: { filters: CustomersUrlParams }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setPending(true);
    setError(null);
    try {
      await exportCustomersCsv(filters);
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
