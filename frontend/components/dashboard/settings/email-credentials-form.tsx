"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Check, Send } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  getEmailCredentials,
  sendEmailTestEmail,
  updateEmailCredentials,
  type EmailCredentials,
  type TestEmailResult,
} from "@/lib/api/integration-credentials";
import { getErrorMessage } from "@/lib/api/types";

const MASKED_PLACEHOLDER = "••••••••••••";

export function EmailCredentialsForm() {
  const [status, setStatus] = useState<EmailCredentials | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [fromName, setFromName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getEmailCredentials()
      .then((data) => {
        if (cancelled) return;
        setStatus(data);
        setFromAddress(data.fromAddress.value ?? "");
        setFromName(data.fromName.value ?? "");
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
      const updated = await updateEmailCredentials({
        apiKey: apiKey || undefined,
        fromAddress,
        fromName,
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

  const credentialsSaved = !loading && Boolean(status?.apiKey.isSet && status?.fromAddress.value);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Email (Mailchimp Transactional)</CardTitle>
          <CardDescription>
            Uses Mailchimp Transactional (Mandrill) to send campaign emails via API key.
            The from address must be a verified sender in your Mailchimp Transactional
            account, or sends will be rejected.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-5">
            <FormField
              htmlFor="email-api-key"
              label="API key"
              description={
                status?.apiKey.isSet
                  ? "A key is already saved — leave blank to keep it, or enter a new one to replace it."
                  : "Not set yet. Find this in Mailchimp Transactional under Settings → API Keys."
              }
            >
              <Input
                id="email-api-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={status?.apiKey.isSet ? MASKED_PLACEHOLDER : "Enter API key"}
                disabled={loading}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                htmlFor="email-from-address"
                label="From address"
                description="Must be a verified sending address/domain in your Mailchimp Transactional account."
              >
                <Input
                  id="email-from-address"
                  type="email"
                  value={fromAddress}
                  onChange={(event) => setFromAddress(event.target.value)}
                  placeholder="noreply@yourdomain.com"
                  disabled={loading}
                />
              </FormField>
              <FormField htmlFor="email-from-name" label="From name (optional)">
                <Input
                  id="email-from-name"
                  value={fromName}
                  onChange={(event) => setFromName(event.target.value)}
                  placeholder="e.g. TopTen"
                  disabled={loading}
                />
              </FormField>
            </div>

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

      <TestEmailCard credentialsSaved={credentialsSaved} />
    </div>
  );
}

function TestEmailCard({ credentialsSaved }: { credentialsSaved: boolean }) {
  const [toAddress, setToAddress] = useState("");
  const [subject, setSubject] = useState("Test email from TopTen Customer Platform");
  const [body, setBody] = useState("This is a test email from TopTen Customer Platform.");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TestEmailResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setResult(null);

    try {
      setResult(await sendEmailTestEmail({ toAddress, subject, body }));
    } catch (err) {
      setError(getErrorMessage(err, "Unable to reach the API server. Please try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send a test email</CardTitle>
        <CardDescription>
          Sends one real email through Mailchimp Transactional to an address you choose — the
          quickest way to confirm the API key and from address actually work. Never touches
          customer data or campaigns.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSend}>
        <CardContent className="flex flex-col gap-5">
          <FormField htmlFor="email-test-to" label="To address">
            <Input
              id="email-test-to"
              type="email"
              value={toAddress}
              onChange={(event) => setToAddress(event.target.value)}
              placeholder="you@example.com"
              disabled={!credentialsSaved || sending}
              required
            />
          </FormField>

          <FormField htmlFor="email-test-subject" label="Subject">
            <Input
              id="email-test-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              disabled={!credentialsSaved || sending}
              required
            />
          </FormField>

          <FormField htmlFor="email-test-body" label="Body">
            <Textarea
              id="email-test-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              disabled={!credentialsSaved || sending}
              required
            />
          </FormField>

          {!credentialsSaved && (
            <p className="text-sm text-muted-foreground">
              Save a Mailchimp Transactional API key and from address above first.
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div
              className={
                result.success
                  ? "flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400"
                  : "flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              }
            >
              {result.success ? (
                <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              )}
              <span className="whitespace-pre-wrap break-words">
                {result.success ? "Sent — " : "Failed — "}
                {result.message}
              </span>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={!credentialsSaved || sending}>
            <Send className="size-4" aria-hidden="true" />
            {sending ? "Sending…" : "Send test email"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
