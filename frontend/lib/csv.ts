/** Quotes a single CSV field per RFC 4180 — wraps it in double quotes
 * (doubling any internal quotes) whenever it contains a comma, quote, or
 * newline; left as-is otherwise. */
function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Builds a CSV string (with a header row) from a 2D array of cell values.
 * A leading UTF-8 BOM is included so Excel opens non-ASCII text (e.g. Bangla
 * names) correctly instead of mangling it as Latin-1. */
export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => escapeCsvField(String(cell))).join(",")
  );
  return "﻿" + lines.join("\r\n");
}

/** Triggers a browser download of the given CSV content — no server round
 * trip, since the data driving this is already loaded client-side (unlike
 * lib/api/customers.ts's exportCustomersCsv, which re-fetches from the API
 * to cover every matching row, not just the current page). */
export function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
