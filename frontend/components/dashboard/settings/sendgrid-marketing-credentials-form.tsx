"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Check, ShieldCheck } from "lucide-react";

import { FormField } from "@/components/dashboard/form-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getSendGridCredentials,
  updateSendGridCredentials,
  type SendGridCredentials,
} from "@/lib/api/sendgrid";
import { getErrorMessage } from "@/lib/api/types";

const MASKED_PLACEHOLDER = "••••••••••••";

export function SendGridMarketingCredentialsForm() {
  const [status, setStatus] = useState<SendGridCredentials | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [listName, setListName] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getSendGridCredentials()
      .then((data) => {
        if (cancelled) return;
        setStatus(data);
        setListName(data.listName.value ?? "");
        setFromName(data.fromName.value ?? "");
        setFromEmail(data.fromEmail.value ?? "");
        setReplyToEmail(data.replyToEmail.value ?? "");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, "Unable to load saved credentials."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const updated = await updateSendGridCredentials({
        apiKey: apiKey || undefined,
        listName,
        fromName,
        fromEmail,
        replyToEmail,
      });
      setStatus(updated);
      setApiKey("");
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to reach the API server. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Marketing (SendGrid)</CardTitle>
        <CardDescription>
          Syncs opted-in customers to a SendGrid List and sends bulk promotional campaigns
          through SendGrid&apos;s own Single Send engine — not one-off transactional email.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-5">
          <FormField
            htmlFor="sendgrid-api-key"
            label="SendGrid API key"
            description={
              status?.apiKey.isSet
                ? "A key is already saved — leave blank to keep it, or enter a new one to replace it."
                : "Not set yet. Find this in SendGrid under Settings → API Keys."
            }
          >
            <Input
              id="sendgrid-api-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={status?.apiKey.isSet ? MASKED_PLACEHOLDER : "Enter API key"}
              disabled={loading}
              required={!status?.apiKey.isSet}
            />
          </FormField>

          <FormField
            htmlFor="sendgrid-list-name"
            label="Marketing List Name"
            description="Found or created in SendGrid under this exact name."
          >
            <Input
              id="sendgrid-list-name"
              value={listName}
              onChange={(event) => setListName(event.target.value)}
              placeholder="e.g. TopTen Customers"
              disabled={loading}
              required
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="sendgrid-from-name" label="From Name">
              <Input
                id="sendgrid-from-name"
                value={fromName}
                onChange={(event) => setFromName(event.target.value)}
                placeholder="e.g. TopTen Mart"
                disabled={loading}
                required
              />
            </FormField>
            <FormField htmlFor="sendgrid-from-email" label="From Email">
              <Input
                id="sendgrid-from-email"
                type="email"
                value={fromEmail}
                onChange={(event) => setFromEmail(event.target.value)}
                placeholder="marketing@yourdomain.com"
                disabled={loading}
                required
              />
            </FormField>
          </div>

          <FormField htmlFor="sendgrid-reply-to-email" label="Reply-To Email">
            <Input
              id="sendgrid-reply-to-email"
              type="email"
              value={replyToEmail}
              onChange={(event) => setReplyToEmail(event.target.value)}
              placeholder="support@yourdomain.com"
              disabled={loading}
            />
          </FormField>

          {!loading &&
            (status?.senderVerified ? (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>Sender verified — SendGrid confirms this from address can send.</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Sender verification required. Verify your sender email or domain in SendGrid
                  before sending campaigns.
                </span>
              </div>
            ))}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="justify-end gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="size-4" aria-hidden="true" />
              Saved
            </span>
          )}
          <Button type="submit" disabled={loading || saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
