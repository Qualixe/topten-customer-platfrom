"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check } from "lucide-react";

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
  getPathaoCredentials,
  updatePathaoCredentials,
  type PathaoCredentials,
} from "@/lib/api/integration-credentials";
import { getErrorMessage } from "@/lib/api/types";

const MASKED_PLACEHOLDER = "••••••••••••";

export function PathaoCredentialsForm() {
  const [status, setStatus] = useState<PathaoCredentials | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getPathaoCredentials()
      .then((data) => {
        if (cancelled) return;
        setStatus(data);
        setClientId(data.clientId.value ?? "");
        setUsername(data.username.value ?? "");
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            getErrorMessage(err, "Unable to load saved credentials.")
          );
        }
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
      const updated = await updatePathaoCredentials({
        clientId,
        clientSecret: clientSecret || undefined,
        username,
        password: password || undefined,
      });
      setStatus(updated);
      setClientSecret("");
      setPassword("");
      setSaved(true);
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to reach the API server. Please try again.")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pathao</CardTitle>
        <CardDescription>
          API credentials for booking deliveries through Pathao Courier. Stored on the
          server for when courier dispatch is connected.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField htmlFor="pathao-client-id" label="Client ID">
              <Input
                id="pathao-client-id"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                disabled={loading}
              />
            </FormField>

            <FormField
              htmlFor="pathao-client-secret"
              label="Client Secret"
              description={
                status?.clientSecret.isSet
                  ? "Already saved — leave blank to keep it."
                  : "Not set yet."
              }
            >
              <Input
                id="pathao-client-secret"
                type="password"
                autoComplete="off"
                value={clientSecret}
                onChange={(event) => setClientSecret(event.target.value)}
                placeholder={status?.clientSecret.isSet ? MASKED_PLACEHOLDER : "Enter client secret"}
                disabled={loading}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField htmlFor="pathao-username" label="Username">
              <Input
                id="pathao-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Merchant account email"
                disabled={loading}
              />
            </FormField>

            <FormField
              htmlFor="pathao-password"
              label="Password"
              description={
                status?.password.isSet ? "Already saved — leave blank to keep it." : "Not set yet."
              }
            >
              <Input
                id="pathao-password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={status?.password.isSet ? MASKED_PLACEHOLDER : "Enter password"}
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
  );
}
