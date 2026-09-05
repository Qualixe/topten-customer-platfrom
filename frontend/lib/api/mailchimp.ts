import { apiGet, apiPost, apiPut } from "@/lib/api/client";
import type { PlainField, SecretField } from "@/lib/api/integration-credentials";
import type { ApiEnvelope } from "@/lib/api/types";

/** Mailchimp Marketing (Audience sync) — see app.common.mailchimp_client on
 * the backend. Deliberately minimal: this app never creates an Audience via
 * the API (Mailchimp requires company/address/permission-reminder fields
 * this app doesn't collect) — the admin creates one in Mailchimp and pastes
 * its id here. `listValid`/`listName` are live-checked at read time (best
 * effort — never throws) so Settings can confirm the id actually resolves
 * rather than assuming it. */
export interface MailchimpCredentials {
  apiKey: SecretField;
  listId: PlainField;
  listValid: boolean;
  listName: string | null;
}

export interface MailchimpCredentialsInput {
  apiKey?: string;
  listId?: string;
}

export async function getMailchimpCredentials(): Promise<MailchimpCredentials> {
  const envelope = await apiGet<ApiEnvelope<MailchimpCredentials>>("/mailchimp/credentials");
  return envelope.data;
}

export async function updateMailchimpCredentials(
  input: MailchimpCredentialsInput
): Promise<MailchimpCredentials> {
  const envelope = await apiPut<ApiEnvelope<MailchimpCredentials>>("/mailchimp/credentials", {
    api_key: input.apiKey,
    list_id: input.listId,
  });
  return envelope.data;
}

export interface MailchimpSyncItemResult {
  customerId: string;
  email: string;
  success: boolean;
  message: string;
}

export interface MailchimpSyncReport {
  total: number;
  synced: number;
  failed: number;
  items: MailchimpSyncItemResult[];
}

/** Upserts the given customers into the configured Audience. */
export async function syncCustomersToMailchimp(customerIds: string[]): Promise<MailchimpSyncReport> {
  const envelope = await apiPost<ApiEnvelope<MailchimpSyncReport>>("/mailchimp/sync", {
    customer_ids: customerIds,
  });
  return envelope.data;
}
