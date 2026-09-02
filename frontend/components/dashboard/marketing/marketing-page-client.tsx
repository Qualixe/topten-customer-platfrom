"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, Check, Megaphone, RefreshCw, Send, X } from "lucide-react";

import { FormField } from "@/components/dashboard/form-field";
import { MarketingCustomerPickerField } from "@/components/dashboard/marketing/marketing-customer-picker-field";
import { StatusPill, type StatusTone } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/lib/api/customers";
import {
  createSendGridCampaignDraft,
  sendSendGridCampaign,
  syncCustomersToSendGrid,
  type SendGridCampaign,
  type SendGridCampaignStatus,
  type SendGridSyncReport,
} from "@/lib/api/sendgrid";
import { getErrorMessage } from "@/lib/api/types";

const STATUS_TONE: Record<SendGridCampaignStatus, StatusTone> = {
  DRAFT: "neutral",
  SENDING: "accent",
  SENT: "success",
  FAILED: "danger",
};

export function MarketingPageClient({
  initialCampaigns,
  canManage,
}: {
  initialCampaigns: SendGridCampaign[];
  canManage: boolean;
}) {
  const [campaigns, setCampaigns] = useState<SendGridCampaign[]>(initialCampaigns);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Marketing</h2>
        <p className="text-sm text-muted-foreground">
          Sync opted-in customers to your SendGrid List, then compose and send a bulk
          promotional campaign through SendGrid&apos;s own Single Send engine.
        </p>
      </div>

      {canManage && <SyncCard />}
      {canManage && <ComposeCard onCreated={(campaign) => setCampaigns((prev) => [campaign, ...prev])} />}

      <CampaignHistoryCard
        campaigns={campaigns}
        canManage={canManage}
        onSent={(sent) =>
          setCampaigns((prev) => prev.map((item) => (item.id === sent.id ? sent : item)))
        }
      />
    </div>
  );
}

function SyncCard() {
  const [selected, setSelected] = useState<Customer[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [report, setReport] = useState<SendGridSyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setReport(null);
    try {
      const result = await syncCustomersToSendGrid(selected.map((customer) => customer.id));
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
        <CardTitle>Sync to SendGrid</CardTitle>
        <CardDescription>
          Upserts the selected customers into your configured SendGrid List. Only customers
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
                <div
                  key={item.customerId}
                  className="flex items-center gap-2 p-2 text-sm"
                >
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

function ComposeCard({ onCreated }: { onCreated: (campaign: SendGridCampaign) => void }) {
  const [selected, setSelected] = useState<Customer[]>([]);
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setCreated(false);

    try {
      const campaign = await createSendGridCampaignDraft({
        customerIds: selected.map((customer) => customer.id),
        subject,
        htmlBody,
        fromName: fromName || undefined,
        fromEmail: fromEmail || undefined,
      });
      onCreated(campaign);
      setCreated(true);
      setSelected([]);
      setSubject("");
      setHtmlBody("");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to reach the API server. Please try again."));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compose a campaign</CardTitle>
        <CardDescription>
          Creates a SendGrid campaign as a draft, scoped to exactly the customers you pick here
          — it does not send. Review it in the history below, then send it as a separate step.
          Customers must already be synced (see above) before they can be included.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <FormField htmlFor="marketing-campaign-customers" label="Customers">
            <MarketingCustomerPickerField selected={selected} onChange={setSelected} />
          </FormField>

          <FormField htmlFor="marketing-campaign-subject" label="Subject">
            <Input
              id="marketing-campaign-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. This month's promotions"
              required
            />
          </FormField>

          <FormField htmlFor="marketing-campaign-body" label="Email body (HTML)">
            <Textarea
              id="marketing-campaign-body"
              value={htmlBody}
              onChange={(event) => setHtmlBody(event.target.value)}
              placeholder="<p>Hello!</p>"
              className="min-h-32 resize-y font-mono text-sm"
              required
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="marketing-campaign-from-name" label="From name (optional)">
              <Input
                id="marketing-campaign-from-name"
                value={fromName}
                onChange={(event) => setFromName(event.target.value)}
                placeholder="Uses your default if left blank"
              />
            </FormField>
            <FormField htmlFor="marketing-campaign-from-email" label="From email (optional)">
              <Input
                id="marketing-campaign-from-email"
                type="email"
                value={fromEmail}
                onChange={(event) => setFromEmail(event.target.value)}
                placeholder="Uses your default if left blank"
              />
            </FormField>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {created && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="size-4" aria-hidden="true" />
              Draft created — send it from the history below.
            </p>
          )}
        </CardContent>
        <div className="flex justify-end p-6 pt-0">
          <Button type="submit" disabled={selected.length === 0 || creating}>
            {creating ? "Creating…" : "Create draft"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function CampaignHistoryCard({
  campaigns,
  canManage,
  onSent,
}: {
  campaigns: SendGridCampaign[];
  canManage: boolean;
  onSent: (campaign: SendGridCampaign) => void;
}) {
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(campaignId: string) {
    setSendingId(campaignId);
    setError(null);
    try {
      const sent = await sendSendGridCampaign(campaignId);
      onSent(sent);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to reach the API server. Please try again."));
    } finally {
      setSendingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign history</CardTitle>
        <CardDescription>Every SendGrid campaign created from this app.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {campaigns.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Compose one above once you've synced some customers."
          />
        ) : (
          <div className="flex flex-col divide-y overflow-hidden rounded-lg border">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{campaign.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {campaign.recipientCount} recipient{campaign.recipientCount === 1 ? "" : "s"}
                    {campaign.errorMessage ? ` — ${campaign.errorMessage}` : ""}
                  </p>
                </div>
                <StatusPill label={campaign.status} tone={STATUS_TONE[campaign.status]} />
                {canManage && campaign.status === "DRAFT" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSend(campaign.id)}
                    disabled={sendingId === campaign.id}
                  >
                    <Send className="size-3.5" aria-hidden="true" />
                    {sendingId === campaign.id ? "Sending…" : "Send"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
