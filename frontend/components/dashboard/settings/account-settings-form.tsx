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
import { changePassword, getCurrentUser, type AuthUser } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/api/types";

export function AccountSettingsForm() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((data) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        // Header already covers the logged-out case; this card just stays empty.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
          <CardDescription>Your profile information</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField htmlFor="full-name" label="Full Name">
            <Input id="full-name" value={user?.name ?? ""} disabled />
          </FormField>

          <FormField htmlFor="role" label="Role">
            <Input id="role" value={user?.role ?? ""} disabled />
          </FormField>

          <FormField htmlFor="account-email" label="Email">
            <Input id="account-email" type="email" value={user?.email ?? ""} disabled />
          </FormField>
        </CardContent>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (next !== confirm) {
      setError("New password and confirmation don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setSaved(true);
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to reach the API server. Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>
          Update the password used to sign in to this dashboard
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-5">
          <FormField htmlFor="current-password" label="Current Password">
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              required
            />
          </FormField>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField htmlFor="new-password" label="New Password">
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={next}
                onChange={(event) => setNext(event.target.value)}
                required
              />
            </FormField>

            <FormField htmlFor="confirm-password" label="Confirm New Password">
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </FormField>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="justify-end gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="size-4" aria-hidden="true" />
              Password updated
            </span>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Updating…" : "Update password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
