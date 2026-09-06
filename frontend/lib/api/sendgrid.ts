import { apiGet, apiPost, apiPut } from "@/lib/api/client";
import type { PlainField, SecretField } from "@/lib/api/integration-credentials";
import type { ApiEnvelope } from "@/lib/api/types";

/** SendGrid Marketing List sync credentials — email itself sends through
 * Mailchimp (see lib/api/mailchimp.ts); this is only for optionally
 * keeping a SendGrid List in sync alongside it. Deliberately minimal:
 * sender/domain verification (SendGrid's own mailing-address and
 * sender-identity requirements) is handled entirely in SendGrid's own
 * dashboard — this app never collects or manages that, it only checks
 * whether a verified sender already exists for `fromEmail` (see
 * `senderVerified`). */
export interface SendGridCredentials {
  apiKey: SecretField;
  listName: PlainField;
  fromName: PlainField;
  fromEmail: PlainField;
  replyToEmail: PlainField;
  /** Live-checked against SendGrid — true only if a verified Sender
   * Identity actually matches `fromEmail` right now. Never assumed. */
  senderVerified: boolean;
}

export interface SendGridCredentialsInput {
  apiKey?: string;
  listName?: string;
  fromName?: string;
  fromEmail?: string;
  replyToEmail?: string;
}

export async function getSendGridCredentials(): Promise<SendGridCredentials> {
  const envelope = await apiGet<ApiEnvelope<SendGridCredentials>>("/sendgrid/credentials");
  return envelope.data;
}

export async function updateSendGridCredentials(
  input: SendGridCredentialsInput
): Promise<SendGridCredentials> {
  const envelope = await apiPut<ApiEnvelope<SendGridCredentials>>("/sendgrid/credentials", {
    api_key: input.apiKey,
    list_name: input.listName,
    from_name: input.fromName,
    from_email: input.fromEmail,
    reply_to_email: input.replyToEmail,
  });
  return envelope.data;
}

export interface SendGridSyncItemResult {
  customerId: string;
  email: string;
  success: boolean;
  message: string;
}

export interface SendGridSyncReport {
  total: number;
  synced: number;
  failed: number;
  items: SendGridSyncItemResult[];
}

/** Upserts the given customers into the configured List — only those with
 * `marketingOptIn` true and a saved email actually get synced; everyone
 * else comes back in `items` as a reported (not silent) failure. */
export async function syncCustomersToSendGrid(customerIds: string[]): Promise<SendGridSyncReport> {
  const envelope = await apiPost<ApiEnvelope<SendGridSyncReport>>("/sendgrid/sync", {
    customer_ids: customerIds,
  });
  return envelope.data;
}

