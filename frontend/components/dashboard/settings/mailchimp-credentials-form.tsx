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
  getMailchimpCredentials,
  updateMailchimpCredentials,
  type MailchimpCredentials,
} from "@/lib/api/mailchimp";
import { getErrorMessage } from "@/lib/api/types";

const MASKED_PLACEHOLDER = "••••••••••••";

export function MailchimpCredentialsForm() {
  const [status, setStatus] = useState<MailchimpCredentials | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [listId, setListId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getMailchimpCredentials()
      .then((data) => {
        if (cancelled) return;
        setStatus(data);
        setListId(data.listId.value ?? "");
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
      const updated = await updateMailchimpCredentials({
        apiKey: apiKey || undefined,
        listId,
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
        <CardTitle>Email (Mailchimp)</CardTitle>
        <CardDescription>
          Syncs opted-in customers to a Mailchimp Audience. Create the Audience in Mailchimp first,
          then paste its id below — this app never creates one via the API.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-5">
          <FormField
            htmlFor="mailchimp-api-key"
            label="Mailchimp API key"
            description={
              status?.apiKey.isSet
                ? "A key is already saved — leave blank to keep it, or enter a new one to replace it."
                : "Find this in Mailchimp under Account → Extras → API keys. Includes the datacenter suffix (e.g. \"-us21\")."
            }
          >
            <Input
              id="mailchimp-api-key"
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
            htmlFor="mailchimp-list-id"
            label="Audience (List) ID"
            description="Found in Mailchimp under Audience → Settings → Audience name and defaults."
          >
            <Input
              id="mailchimp-list-id"
              value={listId}
              onChange={(event) => setListId(event.target.value)}
              placeholder="e.g. a1b2c3d4e5"
              disabled={loading}
              required
            />
          </FormField>

          {!loading &&
            status?.listId.value &&
            (status.listValid ? (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Audience found{status.listName ? `: "${status.listName}"` : ""} — ready to sync.
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Couldn&apos;t confirm this Audience ID against Mailchimp — double-check the API key
                  and Audience ID.
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
