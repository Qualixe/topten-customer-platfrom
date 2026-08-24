"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { listImportRowErrors, type ImportRowError } from "@/lib/api/imports";
import { ApiError } from "@/lib/api/types";

const PAGE_SIZE = 50;

export function ImportErrorsDialog({
  importId,
  fileName,
  open,
  onOpenChange,
}: {
  importId: string | null;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invalid Rows</DialogTitle>
          <DialogDescription>{fileName}</DialogDescription>
        </DialogHeader>

        {/* Keyed by importId so switching batches remounts with fresh state
         * instead of needing to manually reset it in an effect. */}
        {open && importId && <ImportErrorsList key={importId} importId={importId} />}
      </DialogContent>
    </Dialog>
  );
}

function ImportErrorsList({ importId }: { importId: string }) {
  const [errors, setErrors] = useState<ImportRowError[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    listImportRowErrors(importId, PAGE_SIZE, 0)
      .then(({ items, total: totalCount }) => {
        if (cancelled) return;
        setErrors(items);
        setTotal(totalCount);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Unable to load invalid rows.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [importId]);

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const { items } = await listImportRowErrors(importId, PAGE_SIZE, errors.length);
      setErrors((prev) => [...prev, ...items]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load more rows.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <div className="max-h-[60vh] overflow-y-auto">
        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {!loading && error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && errors.length === 0 && (
          <p className="text-sm text-muted-foreground">No invalid rows.</p>
        )}

        {!loading && !error && errors.length > 0 && (
          <ul className="flex flex-col divide-y">
            {errors.map((rowError) => {
              const isExpanded = expandedRow === rowError.rowNumber;
              const fields = Object.entries(rowError.rawRow).filter(([, value]) =>
                value?.trim()
              );

              return (
                <li key={rowError.rowNumber} className="py-2">
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 text-left"
                    onClick={() => setExpandedRow(isExpanded ? null : rowError.rowNumber)}
                  >
                    {isExpanded ? (
                      <ChevronDown
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    ) : (
                      <ChevronRight
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Row {rowError.rowNumber}</p>
                      <p className="flex items-start gap-1 text-xs text-destructive">
                        <AlertCircle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                        {rowError.errorMessage}
                      </p>
                    </div>
                  </button>

                  {isExpanded && (
                    <dl className="mt-2 ml-6 grid grid-cols-1 gap-x-4 gap-y-1 rounded-md bg-muted/50 p-3 text-xs sm:grid-cols-2">
                      {fields.length === 0 && (
                        <span className="text-muted-foreground">Row is empty.</span>
                      )}
                      {fields.map(([key, value]) => (
                        <div key={key} className="flex gap-1.5 overflow-hidden">
                          <dt className="shrink-0 font-medium text-muted-foreground">
                            {key.replace(/\s+/g, " ").trim()}:
                          </dt>
                          <dd className="truncate">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!loading && errors.length < total && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="mt-2 w-fit"
        >
          {loadingMore ? "Loading…" : `Load more (${errors.length} of ${total})`}
        </Button>
      )}
    </>
  );
}
