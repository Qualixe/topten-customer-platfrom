"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { CustomerTypeSelect } from "@/components/dashboard/imports/customer-type-select";
import { ImportHistoryTable } from "@/components/dashboard/imports/import-history-table";
import { ImportProgress } from "@/components/dashboard/imports/import-progress";
import { ImportInstructions } from "@/components/dashboard/imports/import-instructions";
import {
  currentPeriod,
  parsePeriod,
  PeriodSelect,
  type PeriodValue,
} from "@/components/dashboard/imports/period-select";
import {
  SelectedFileCard,
  type FileValidationState,
} from "@/components/dashboard/imports/selected-file-card";
import { UploadArea } from "@/components/dashboard/imports/upload-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getImportBatch,
  listImportBatches,
  uploadCustomerImport,
  type ImportBatch,
} from "@/lib/api/imports";
import { ApiError } from "@/lib/api/types";
import type { CustomerType } from "@/lib/mock/customers";
import { MAX_FILE_SIZE_BYTES } from "@/lib/mock/imports";

const POLL_INTERVAL_MS = 1200;
const MAX_POLL_ATTEMPTS = 100; // ~2 minutes
const MAX_CONSECUTIVE_POLL_ERRORS = 5; // ~6 seconds — a real failure, not a blip

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  GENERAL: "General",
  VIP: "VIP",
  VVIP: "VVIP",
};

const TERMINAL_STATUSES: ImportBatch["status"][] = [
  "COMPLETED",
  "COMPLETED_WITH_ERRORS",
  "FAILED",
  "CANCELLED",
];

export function ImportsWorkspace({ initialHistory }: { initialHistory: ImportBatch[] }) {
  const [history, setHistory] = useState(initialHistory);
  const [customerType, setCustomerType] = useState<CustomerType>("GENERAL");
  const [period, setPeriod] = useState<PeriodValue>(currentPeriod());
  const [file, setFile] = useState<File | null>(null);
  const [validationState, setValidationState] =
    useState<FileValidationState>("validating");
  const [validationError, setValidationError] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeBatch, setActiveBatch] = useState<ImportBatch | null>(null);
  const [completedBatch, setCompletedBatch] = useState<ImportBatch | null>(null);
  const [stalled, setStalled] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  async function refreshHistory() {
    try {
      const { items } = await listImportBatches(20);
      setHistory(items);
    } catch {
      // Non-fatal — the just-completed batch's own summary card already
      // shows the result; a stale history list can just be refreshed later.
    }
  }

  function pollBatch(importId: string, attempt: number = 0, consecutiveErrors: number = 0) {
    pollTimerRef.current = setTimeout(async () => {
      let batch: ImportBatch;
      try {
        batch = await getImportBatch(importId);
      } catch (error) {
        // A transient network hiccup shouldn't kill polling — retry a few
        // times, but a *real*, persistent failure (e.g. a client bug) must
        // surface instead of retrying silently for the full ~2 minutes.
        const nextConsecutiveErrors = consecutiveErrors + 1;
        if (nextConsecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          setActiveBatch(null);
          setUploadError(
            error instanceof ApiError
              ? error.message
              : "Lost the connection to the API server while checking import progress."
          );
          return;
        }
        pollBatch(importId, attempt + 1, nextConsecutiveErrors);
        return;
      }

      setActiveBatch(batch);

      if (TERMINAL_STATUSES.includes(batch.status)) {
        setActiveBatch(null);
        setCompletedBatch(batch);
        void refreshHistory();
        return;
      }

      if (attempt >= MAX_POLL_ATTEMPTS) {
        setStalled(true);
        return;
      }

      pollBatch(importId, attempt + 1, 0);
    }, POLL_INTERVAL_MS);
  }

  function handleFileSelected(selected: File) {
    setUploadError(null);
    setCompletedBatch(null);
    setFile(selected);
    setValidationState("validating");
    setValidationError(undefined);

    timeoutRef.current = setTimeout(() => {
      const isCsv = /\.csv$/i.test(selected.name);
      const withinSize = selected.size <= MAX_FILE_SIZE_BYTES;

      if (!isCsv) {
        setValidationState("invalid");
        setValidationError("Unsupported file type. Please upload a .csv file.");
        return;
      }

      if (!withinSize) {
        setValidationState("invalid");
        setValidationError(
          `File is too large. Maximum size is ${Math.round(
            MAX_FILE_SIZE_BYTES / (1024 * 1024)
          )}MB.`
        );
        return;
      }

      setValidationState("valid");
    }, 400);
  }

  function handleRemoveFile() {
    setFile(null);
    setValidationError(undefined);
  }

  async function handleStartImport() {
    if (!file) return;
    const parsedPeriod = parsePeriod(period);
    if (!parsedPeriod) {
      setUploadError("Choose which month this file covers before importing.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setStalled(false);

    try {
      const uploadedFileName = file.name;
      const created = await uploadCustomerImport({
        file,
        periodYear: parsedPeriod.year,
        periodMonth: parsedPeriod.month,
        customerType,
      });
      setFile(null);
      // Placeholder shown until the first real poll resolves — the upload
      // response only has {importId, status, customerType}, not progress.
      setActiveBatch({
        importId: created.importId,
        fileName: uploadedFileName,
        periodYear: parsedPeriod.year,
        periodMonth: parsedPeriod.month,
        customerType: created.customerType,
        status: created.status,
        totalRows: 0,
        processedRows: 0,
        newCustomers: 0,
        updatedCustomers: 0,
        duplicateRows: 0,
        invalidRows: 0,
        totalSpending: 0,
        progressPercentage: 0,
        startedAt: null,
        completedAt: null,
        createdAt: new Date().toISOString(),
      });
      pollBatch(created.importId);
    } catch (error) {
      setUploadError(
        error instanceof ApiError
          ? error.message
          : "Unable to reach the API server. Please try again."
      );
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || !!activeBatch;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Upload Customers</CardTitle>
            <CardDescription>
              Import a batch of customers from a CSV file
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {completedBatch && (
              <Alert
                variant={
                  completedBatch.status === "FAILED" ? "destructive" : "default"
                }
              >
                <CheckCircle2 />
                <AlertTitle>
                  {completedBatch.status === "FAILED"
                    ? "Import failed"
                    : "Import complete"}
                </AlertTitle>
                <AlertDescription>
                  <div className="flex flex-col gap-1">
                    <p>
                      Customer Type: {CUSTOMER_TYPE_LABELS[completedBatch.customerType]}
                    </p>
                    <p>
                      Total rows: {completedBatch.totalRows} · New:{" "}
                      {completedBatch.newCustomers} · Updated:{" "}
                      {completedBatch.updatedCustomers} · Duplicate:{" "}
                      {completedBatch.duplicateRows} · Invalid:{" "}
                      {completedBatch.invalidRows}
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {uploadError && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Import failed</AlertTitle>
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}

            {stalled && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Still processing</AlertTitle>
                <AlertDescription>
                  This is taking longer than expected — the background worker
                  may not be running. Check{" "}
                  <span className="font-medium">Import History</span> below for
                  the latest status.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CustomerTypeSelect
                value={customerType}
                onChange={setCustomerType}
                disabled={busy}
              />
              <PeriodSelect value={period} onChange={setPeriod} disabled={busy} />
            </div>

            {!file && (
              <UploadArea onFileSelected={handleFileSelected} disabled={busy} />
            )}

            {file && (
              <SelectedFileCard
                file={file}
                validationState={validationState}
                validationError={validationError}
                importing={busy}
                onStartImport={handleStartImport}
                onRemove={handleRemoveFile}
              />
            )}

            {activeBatch && (
              <ImportProgress
                fileName={activeBatch.fileName}
                progress={Math.round(activeBatch.progressPercentage)}
              />
            )}
          </CardContent>
        </Card>

        <ImportHistoryTable history={history} />
      </div>

      <ImportInstructions />
    </div>
  );
}
