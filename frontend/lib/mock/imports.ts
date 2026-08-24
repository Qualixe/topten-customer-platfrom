import type { CustomerType } from "@/lib/mock/customers";

export type ImportStatus = "Completed" | "Partial" | "Failed" | "Processing";

export interface ImportRecord {
  id: string;
  fileName: string;
  importedAt: string;
  status: ImportStatus;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  fileSizeLabel: string;
  uploadedBy: string;
  /** The customer category this whole file was imported as. Required for
   * new imports; optional here only because older mock history rows predate
   * this field. */
  customerType?: CustomerType;
  errorMessage?: string;
}

/** Matches the backend's real CSV parser — see
 * backend/app/modules/imports/validation.py:validate_row. */
export const REQUIRED_COLUMNS = ["name", "phone", "amount"] as const;

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const mockImportHistory: ImportRecord[] = [
  {
    id: "import-1",
    fileName: "customers_august_batch.csv",
    importedAt: "Today, 10:24 AM",
    status: "Completed",
    totalRows: 312,
    importedRows: 312,
    failedRows: 0,
    fileSizeLabel: "184 KB",
    uploadedBy: "Store Admin",
    customerType: "GENERAL",
  },
  {
    id: "import-2",
    fileName: "loyalty_signups_week32.csv",
    importedAt: "Aug 14, 2026",
    status: "Partial",
    totalRows: 158,
    importedRows: 149,
    failedRows: 9,
    fileSizeLabel: "96 KB",
    uploadedBy: "Rafiq Islam",
    customerType: "GENERAL",
    errorMessage: "9 rows skipped: invalid phone number format.",
  },
  {
    id: "import-3",
    fileName: "vip_migration_2026.csv",
    importedAt: "Aug 9, 2026",
    status: "Failed",
    totalRows: 0,
    importedRows: 0,
    failedRows: 0,
    fileSizeLabel: "212 KB",
    uploadedBy: "Store Admin",
    customerType: "VIP",
    errorMessage: "Missing required column: 'email'.",
  },
  {
    id: "import-4",
    fileName: "birthday_club_july.csv",
    importedAt: "Jul 28, 2026",
    status: "Completed",
    totalRows: 87,
    importedRows: 87,
    failedRows: 0,
    fileSizeLabel: "41 KB",
    uploadedBy: "Nusrat Jahan",
    customerType: "VVIP",
  },
  {
    id: "import-5",
    fileName: "walk_in_customers_q2.csv",
    importedAt: "Jun 30, 2026",
    status: "Partial",
    totalRows: 420,
    importedRows: 401,
    failedRows: 19,
    fileSizeLabel: "260 KB",
    uploadedBy: "Store Admin",
    customerType: "GENERAL",
    errorMessage: "19 rows skipped: duplicate email address.",
  },
];
