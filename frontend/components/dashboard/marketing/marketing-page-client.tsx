"use client";

import { useState } from "react";
import { AlertTriangle, Check, ExternalLink, Mail, RefreshCw, Send, X } from "lucide-react";

import { MarketingCustomerPickerField } from "@/components/dashboard/marketing/marketing-customer-picker-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/dashboard/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/lib/api/customers";
import {
  sendMailchimpCampaign,
  syncCustomersToMailchimp,
  type MailchimpSendReport,
  type MailchimpSyncItemResult,
  type MailchimpSyncReport,
} from "@/lib/api/mailchimp";
import { getErrorMessage } from "@/lib/api/types";

/** Sync opted-in customers into a Mailchimp Audience, and compose & send
 * real campaigns to them directly from this app — Mailchimp is the single
 * email provider for both, so nothing here hands off to Mailchimp's own
 * dashboard anymore. */
export function MarketingPageClient({ canManage }: { canManage: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Marketing</h2>
        <p className="text-sm text-muted-foreground">
          Sync opted-in customers to Mailchimp, then compose and send campaigns to them.
        </p>
      </div>

      {canManage ? (
        <>
          <SyncCard />
          <SendCard />
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Marketing</CardTitle>
            <CardDescription>
              You don&apos;t have permission to sync customers or send campaigns.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function SyncCard() {
  const [selected, setSelected] = useState<Customer[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [report, setReport] = useState<MailchimpSyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setReport(null);
    try {
      const result = await syncCustomersToMailchimp(selected.map((customer) => customer.id));
      setReport(result);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to reach the API server. Please try again."));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync to Mailchimp</CardTitle>
        <CardDescription>
          Upserts the selected customers into your configured Mailchimp Audience. Only customers
          who&apos;ve opted into marketing email are ever synced.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <MarketingCustomerPickerField selected={selected} onChange={setSelected} />

        <div>
          <Button type="button" onClick={handleSync} disabled={selected.length === 0 || syncing}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {syncing ? "Syncing…" : `Sync ${selected.length || ""} customer${selected.length === 1 ? "" : "s"}`}
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {report && (
          <>
            <p className="text-sm text-muted-foreground">
              {report.synced} of {report.total} synced
              {report.failed > 0 ? `, ${report.failed} failed` : ""}.
            </p>
            <SyncResultList items={report.items} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SyncResultList({ items }: { items: MailchimpSyncItemResult[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col divide-y overflow-hidden rounded-lg border">
        {items.map((item) => (
          <div key={item.customerId} className="flex items-center gap-2 p-2 text-sm">
            {item.success ? (
              <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            ) : (
              <X className="size-4 shrink-0 text-destructive" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1 truncate">{item.email || item.customerId}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{item.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type SendStep = "compose" | "review";

function SendCard() {
  const [step, setStep] = useState<SendStep>("compose");
  const [recipients, setRecipients] = useState<Customer[]>([]);
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<MailchimpSendReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canReview = recipients.length > 0 && subject.trim().length > 0 && htmlBody.trim().length > 0;

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const result = await sendMailchimpCampaign({
        customerIds: recipients.map((customer) => customer.id),
        subject,
        htmlBody,
      });
      setReport(result);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to reach the API server. Please try again."));
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setStep("compose");
    setRecipients([]);
    setSubject("");
    setHtmlBody("");
    setReport(null);
    setError(null);
  }

  if (report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaign sent</CardTitle>
          <CardDescription>
            {report.sent} of {report.total} recipient{report.total === 1 ? "" : "s"} reached
            {report.failed > 0 ? `, ${report.failed} failed` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SyncResultList items={report.items} />
          {report.campaignUrl && (
            <div>
              <Button
                type="button"
                variant="outline"
                nativeButton={false}
                render={<a href={report.campaignUrl} target="_blank" rel="noreferrer" />}
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                View in Mailchimp
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="button" variant="outline" onClick={reset}>
            Compose another
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compose &amp; send</CardTitle>
        <CardDescription>
          {step === "compose"
            ? "Pick recipients and write the campaign — sending goes out through your configured Mailchimp Audience."
            : "Review before sending — this can't be undone once sent."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {step === "compose" ? (
          <>
            <FormField htmlFor="mailchimp-send-recipients" label="Recipients">
              <MarketingCustomerPickerField selected={recipients} onChange={setRecipients} />
            </FormField>

            <FormField htmlFor="mailchimp-send-subject" label="Subject">
              <Input
                id="mailchimp-send-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="e.g. This month's newsletter"
              />
            </FormField>

            <FormField
              htmlFor="mailchimp-send-body"
              label="Body"
              description="Basic HTML is supported (e.g. <p>, <a>, <b>)."
            >
              <Textarea
                id="mailchimp-send-body"
                value={htmlBody}
                onChange={(event) => setHtmlBody(event.target.value)}
                placeholder="Write your email here…"
                className="min-h-48 font-mono text-sm"
              />
            </FormField>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-0 divide-y rounded-lg border">
              <div className="flex items-center justify-between gap-4 p-3 text-sm">
                <span className="text-muted-foreground">Recipients</span>
                <span className="font-medium">{recipients.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4 p-3 text-sm">
                <span className="text-muted-foreground">Subject</span>
                <span className="max-w-[60%] truncate font-medium">{subject}</span>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div
                className="text-sm [&_a]:underline [&_a]:underline-offset-2 [&_p]:my-2"
                // Preview-only, rendered inside the same authenticated
                // dashboard the admin just typed it into — not
                // untrusted third-party content.
                dangerouslySetInnerHTML={{ __html: htmlBody }}
              />
            </div>
          </>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-between">
        {step === "review" ? (
          <Button type="button" variant="outline" onClick={() => setStep("compose")} disabled={sending}>
            Back
          </Button>
        ) : (
          <span />
        )}
        {step === "compose" ? (
          <Button type="button" onClick={() => setStep("review")} disabled={!canReview}>
            <Mail className="size-4" aria-hidden="true" />
            Continue to Review
          </Button>
        ) : (
          <Button type="button" onClick={handleSend} disabled={sending}>
            <Send className="size-4" aria-hidden="true" />
            {sending ? "Sending…" : "Send campaign"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
