import { apiPost } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/types";

export interface DatabaseResetResult {
  backupFile: string;
  resetAt: string;
}

/**
 * Wipes all business/customer data via `POST /api/v1/settings/database/reset`
 * — customers, campaigns, imports, forms, gifts, deliveries, message
 * templates. User accounts, roles/permissions, site settings, and
 * integration credentials are left untouched (see the backend's
 * `app.services.database_reset` for the exact scope). `confirm` must be
 * the literal string "RESET" — enforced server-side too, not just as a
 * frontend nicety.
 */
export async function resetDatabase(confirm: string): Promise<DatabaseResetResult> {
  const envelope = await apiPost<ApiEnvelope<DatabaseResetResult>>("/settings/database/reset", {
    confirm,
  });
  return envelope.data;
}
