import { API_BASE_URL, apiGet } from "@/lib/api/client";
import { ApiError, NetworkError } from "@/lib/api/types";
import type { CustomerType } from "@/lib/mock/customers";

export type ImportBatchStatus =
  | "UPLOADED"
  | "VALIDATING"
  | "PROCESSING"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS"
  | "FAILED"
  | "CANCELLED";

export interface ImportBatch {
  importId: string;
  fileName: string;
  periodYear: number;
  periodMonth: number;
  customerType: CustomerType;
  status: ImportBatchStatus;
  totalRows: number;
  processedRows: number;
  newCustomers: number;
  updatedCustomers: number;
  duplicateRows: number;
  invalidRows: number;
  totalSpending: number;
  progressPercentage: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** Shape of one batch after `camelizeKeys`. */
interface ImportBatchDto {
  importId: string;
  fileName: string;
  periodYear: number;
  periodMonth: number;
  customerType: string;
  status: ImportBatchStatus;
  totalRows: number;
  processedRows: number;
  newCustomers: number;
  updatedCustomers: number;
  duplicateRows: number;
  invalidRows: number;
  totalSpending: string | number;
  progressPercentage: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

function mapDtoToImportBatch(dto: ImportBatchDto): ImportBatch {
  return {
    importId: dto.importId,
    fileName: dto.fileName,
    periodYear: dto.periodYear,
    periodMonth: dto.periodMonth,
    customerType: dto.customerType as CustomerType,
    status: dto.status,
    totalRows: dto.totalRows,
    processedRows: dto.processedRows,
    newCustomers: dto.newCustomers,
    updatedCustomers: dto.updatedCustomers,
    duplicateRows: dto.duplicateRows,
    invalidRows: dto.invalidRows,
    totalSpending: Number(dto.totalSpending),
    progressPercentage: dto.progressPercentage,
    startedAt: dto.startedAt,
    completedAt: dto.completedAt,
    createdAt: dto.createdAt,
  };
}

export interface UploadCustomerImportInput {
  file: File;
  periodYear: number;
  periodMonth: number;
  customerType: CustomerType;
}

/**
 * POST /api/v1/imports/customers only returns `{import_id, status,
 * customer_type}` (`ImportBatchCreateData` on the backend) — not the full
 * batch detail `GET /imports/{id}` returns. Callers should immediately poll
 * `getImportBatch(importId)` for the real progress/summary.
 */
export interface CreatedImportBatch {
  importId: string;
  status: ImportBatchStatus;
  customerType: CustomerType;
}

/**
 * POST /api/v1/imports/customers — multipart, so this bypasses `apiFetch`
 * (which always sets `Content-Type: application/json`) the same way
 * `uploadSiteLogo` does. Reads the raw snake_case body directly rather than
 * `camelizeKeys` (which `apiFetch` applies automatically but this manual
 * fetch doesn't) — this response's shape doesn't match the full
 * `ImportBatchDto` this module otherwise works with.
 */
export async function uploadCustomerImport(
  input: UploadCustomerImportInput
): Promise<CreatedImportBatch> {
  const formData = new FormData();
  formData.append("period_year", String(input.periodYear));
  formData.append("period_month", String(input.periodMonth));
  formData.append("customer_type", input.customerType);
  formData.append("file", input.file);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/imports/customers`, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : undefined);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let message = body || response.statusText;
    try {
      const parsed = JSON.parse(body) as { detail?: string | { msg: string }[] };
      if (Array.isArray(parsed.detail)) {
        message = parsed.detail.map((entry) => entry.msg).join("; ");
      } else if (parsed.detail) {
        message = parsed.detail;
      }
    } catch {
      // Not JSON — fall back to the raw text/status above.
    }
    throw new ApiError(message, response.status);
  }

  const body = (await response.json()) as {
    data: { import_id: string; status: ImportBatchStatus; customer_type: string };
  };
  return {
    importId: body.data.import_id,
    status: body.data.status,
    customerType: body.data.customer_type as CustomerType,
  };
}

export async function getImportBatch(importId: string): Promise<ImportBatch> {
  const envelope = await apiGet<{ success: boolean; data: ImportBatchDto }>(
    `/imports/${importId}`
  );
  return mapDtoToImportBatch(envelope.data);
}

export async function listImportBatches(
  limit: number = 20
): Promise<{ items: ImportBatch[]; total: number }> {
  const envelope = await apiGet<{ success: boolean; data: ImportBatchDto[]; total: number }>(
    `/imports?limit=${limit}`
  );
  return { items: envelope.data.map(mapDtoToImportBatch), total: envelope.total };
}

export interface ImportRowError {
  rowNumber: number;
  errorMessage: string;
  /** The original CSV row, keyed by that file's own (possibly messy) column
   * headers — shown as-is so it's easy to match back against the source file. */
  rawRow: Record<string, string>;
}

interface ImportRowErrorDto {
  rowNumber: number;
  errorMessage: string;
  rawRow: Record<string, string>;
}

export async function listImportRowErrors(
  importId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ items: ImportRowError[]; total: number }> {
  const envelope = await apiGet<{ success: boolean; data: ImportRowErrorDto[]; total: number }>(
    `/imports/${importId}/errors?limit=${limit}&offset=${offset}`
  );
  return {
    items: envelope.data.map((dto) => ({
      rowNumber: dto.rowNumber,
      errorMessage: dto.errorMessage,
      rawRow: dto.rawRow,
    })),
    total: envelope.total,
  };
}
