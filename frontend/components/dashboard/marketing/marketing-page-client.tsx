"use client";

import { useState } from "react";
import { AlertTriangle, Check, ExternalLink, RefreshCw, X } from "lucide-react";

import { MarketingCustomerPickerField } from "@/components/dashboard/marketing/marketing-customer-picker-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Customer } from "@/lib/api/customers";
import { syncCustomersToMailchimp, type MailchimpSyncReport } from "@/lib/api/mailchimp";
import { getErrorMessage } from "@/lib/api/types";

/** Sync-only — this app deliberately doesn't build a campaign-sending flow
 * on top of Mailchimp (see app.services.mailchimp_sync's docstring):
 * compose and send the actual email from Mailchimp's own dashboard once
 * customers are synced here. Previously this page also created/sent
 * SendGrid campaigns directly; that flow has been retired now that
 * Mailchimp is the only email provider in use. */
export function MarketingPageClient({ canManage }: { canManage: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Marketing</h2>
        <p className="text-sm text-muted-foreground">
          Sync opted-in customers to your Mailchimp Audience, then compose and send your
          campaign from Mailchimp&apos;s own dashboard.
        </p>
      </div>

      {canManage ? (
        <SyncCard />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sync to Mailchimp</CardTitle>
            <CardDescription>
              You don&apos;t have permission to sync customers to Mailchimp.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Compose &amp; send</CardTitle>
          <CardDescription>
            Once your customers are synced, open Mailchimp to design and send the campaign —
            this app doesn&apos;t duplicate Mailchimp&apos;s own campaign builder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            render={<a href="https://admin.mailchimp.com/campaigns/" target="_blank" rel="noreferrer" />}
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Open Mailchimp
          </Button>
        </CardContent>
      </Card>
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
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {report.synced} of {report.total} synced
              {report.failed > 0 ? `, ${report.failed} failed` : ""}.
            </p>
            <div className="flex flex-col divide-y overflow-hidden rounded-lg border">
              {report.items.map((item) => (
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
        )}
      </CardContent>
    </Card>
  );
}
