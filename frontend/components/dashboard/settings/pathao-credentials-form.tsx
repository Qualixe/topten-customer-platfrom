"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Search } from "lucide-react";

import { FormField } from "@/components/dashboard/form-field";
import { SettingsSwitchRow } from "@/components/dashboard/settings/settings-switch-row";
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
  listPathaoStores,
  updatePathaoCredentials,
  type PathaoCredentials,
  type PathaoLocation,
} from "@/lib/api/integration-credentials";
import { getErrorMessage } from "@/lib/api/types";

const MASKED_PLACEHOLDER = "••••••••••••";

export function PathaoCredentialsForm() {
  const [status, setStatus] = useState<PathaoCredentials | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [storeId, setStoreId] = useState("");
  const [sandbox, setSandbox] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [stores, setStores] = useState<PathaoLocation[] | null>(null);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getPathaoCredentials()
      .then((data) => {
        if (cancelled) return;
        setStatus(data);
        setClientId(data.clientId.value ?? "");
        setUsername(data.username.value ?? "");
        setStoreId(data.storeId.value ?? "");
        setSandbox(data.sandbox);
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
        storeId,
        sandbox,
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

  async function handleLookupStores() {
    setStoresLoading(true);
    setStoresError(null);
    try {
      const result = await listPathaoStores();
      setStores(result);
      if (result.length === 1) setStoreId(String(result[0].id));
    } catch (err) {
      setStoresError(
        getErrorMessage(err, "Unable to fetch stores. Save your credentials first.")
      );
    } finally {
      setStoresLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pathao</CardTitle>
        <CardDescription>
          Real API credentials for dispatching deliveries through Pathao Courier — saving
          these lets &ldquo;Add Delivery&rdquo; create a live shipment and pull back a real
          tracking number instead of you typing one in by hand.
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

          <FormField
            htmlFor="pathao-store-id"
            label="Store ID"
            description="The store this business ships from, from your Pathao merchant account."
          >
            <div className="flex gap-2">
              <Input
                id="pathao-store-id"
                inputMode="numeric"
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
                placeholder="e.g. 401253"
                disabled={loading}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleLookupStores}
                disabled={loading || storesLoading}
              >
                <Search />
                {storesLoading ? "Looking up…" : "Look up my stores"}
              </Button>
            </div>
            {storesError && <p className="mt-1.5 text-sm text-destructive">{storesError}</p>}
            {stores && stores.length > 0 && (
              <div className="mt-2 flex flex-col gap-1 rounded-lg border p-1.5">
                {stores.map((store) => (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => setStoreId(String(store.id))}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
                  >
                    <span>{store.name}</span>
                    <span className="text-xs text-muted-foreground">#{store.id}</span>
                  </button>
                ))}
              </div>
            )}
            {stores && stores.length === 0 && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                No stores found on this Pathao account yet.
              </p>
            )}
          </FormField>

          <SettingsSwitchRow
            id="pathao-sandbox"
            label="Sandbox mode"
            description="Test against Pathao's sandbox instead of creating real shipments. Turn this off only once you're ready to dispatch for real."
            checked={sandbox}
            onCheckedChange={setSandbox}
          />

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
