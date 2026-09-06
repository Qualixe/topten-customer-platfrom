import { apiGet, apiPost, apiPut } from "@/lib/api/client";
import type { PlainField, SecretField } from "@/lib/api/integration-credentials";
import type { ApiEnvelope } from "@/lib/api/types";

/** Mailchimp Marketing (Audience sync + campaign send) — see
 * app.common.mailchimp_client on the backend. Deliberately minimal: this
 * app never creates an Audience via the API (Mailchimp requires
 * company/address/permission-reminder fields this app doesn't collect) —
 * the admin creates one in Mailchimp and pastes its id here.
 * `listValid`/`listName` are live-checked at read time (best effort —
 * never throws) so Settings can confirm the id actually resolves rather
 * than assuming it. `fromName`/`replyToEmail` are only needed to send a
 * campaign, not to sync — the from-email address itself comes from the
 * Audience's own Campaign Defaults, set in Mailchimp directly. */
export interface MailchimpCredentials {
  apiKey: SecretField;
  listId: PlainField;
  listValid: boolean;
  listName: string | null;
  fromName: PlainField;
  replyToEmail: PlainField;
}

export interface MailchimpCredentialsInput {
  apiKey?: string;
  listId?: string;
  fromName?: string;
  replyToEmail?: string;
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
    from_name: input.fromName,
    reply_to_email: input.replyToEmail,
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

export interface MailchimpSendReport {
  total: number;
  sent: number;
  failed: number;
  items: MailchimpSyncItemResult[];
  /** Link to view the sent campaign in Mailchimp's own dashboard — null
   * only if sending failed before Mailchimp assigned a campaign at all
   * (e.g. no eligible recipients). */
  campaignUrl: string | null;
}

/** Sends a test email to one or more raw addresses — creates a throwaway
 * Mailchimp draft and uses Mailchimp's own "test send" feature, so the
 * rendered output matches exactly what a real send would look like.
 * No customer records are touched. */
export async function sendMailchimpTestEmail(input: {
  testEmails: string[];
  subject: string;
  htmlBody: string;
}): Promise<void> {
  await apiPost<void>("/mailchimp/send-test", {
    test_emails: input.testEmails,
    subject: input.subject,
    html_body: input.htmlBody,
  });
}

/** Sends a real Mailchimp campaign to exactly the given customers, in one
 * step: upserts each as a list member, scopes a fresh static segment to
 * just them, and sends against it. Irreversible — there's no draft/review
 * step on the backend, so the caller's own review UI is the only chance
 * to catch a mistake before this fires. */
export async function sendMailchimpCampaign(input: {
  customerIds: string[];
  subject: string;
  htmlBody: string;
}): Promise<MailchimpSendReport> {
  const envelope = await apiPost<ApiEnvelope<MailchimpSendReport>>("/mailchimp/send", {
    customer_ids: input.customerIds,
    subject: input.subject,
    html_body: input.htmlBody,
  });
  return envelope.data;
}
