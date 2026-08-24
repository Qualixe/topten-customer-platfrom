"use client";

import { useState } from "react";
import { AlertCircle, FileSpreadsheet } from "lucide-react";

import { CustomerTypeBadge } from "@/components/dashboard/customers/customer-type-badge";
import { EmptyHistory } from "@/components/dashboard/imports/empty-history";
import { ImportErrorsDialog } from "@/components/dashboard/imports/import-errors-dialog";
import { ImportStatusBadge } from "@/components/dashboard/imports/import-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImportBatch } from "@/lib/api/imports";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatPeriod(batch: ImportBatch): string {
  return `${MONTH_NAMES[batch.periodMonth - 1] ?? batch.periodMonth} ${batch.periodYear}`;
}

function formatImportedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
}

export function ImportHistoryTable({ history }: { history: ImportBatch[] }) {
  const [viewingBatch, setViewingBatch] = useState<ImportBatch | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import History</CardTitle>
        <CardDescription>Your most recent CSV imports</CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <EmptyHistory />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Customer Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rows Imported</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((batch) => (
                <TableRow key={batch.importId}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <FileSpreadsheet
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <p className="truncate text-sm font-medium">{batch.fileName}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <CustomerTypeBadge customerType={batch.customerType} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatPeriod(batch)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <ImportStatusBadge status={batch.status} />
                      {batch.invalidRows > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setViewingBatch(batch);
                            setDialogOpen(true);
                          }}
                          className="flex items-start gap-1 text-xs text-destructive underline-offset-2 hover:underline"
                        >
                          <AlertCircle
                            className="mt-0.5 size-3 shrink-0"
                            aria-hidden="true"
                          />
                          {batch.invalidRows} row{batch.invalidRows === 1 ? "" : "s"} invalid
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {batch.totalRows > 0
                      ? `${batch.processedRows} / ${batch.totalRows}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatImportedAt(batch.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <ImportErrorsDialog
        importId={viewingBatch?.importId ?? null}
        fileName={viewingBatch?.fileName ?? ""}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </Card>
  );
}
