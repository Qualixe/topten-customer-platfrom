"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/api/types";

export function SettingsCard({
  title,
  description,
  children,
  onSave,
  footerExtra,
}: {
  title: string;
  description: string;
  children: ReactNode;
  /** Called on submit. If omitted, submitting just flashes "Saved" locally
   * without persisting anything — the mock behavior every not-yet-wired
   * settings section still uses. */
  onSave?: () => Promise<void>;
  /** Extra controls shown in the footer, left of the Saved/Save changes
   * pair (e.g. a "Send now" action). */
  footerExtra?: ReactNode;
}) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (onSave) {
      setSaving(true);
      try {
        await onSave();
        setSaved(true);
      } catch (err) {
        setError(getErrorMessage(err, "Unable to save. Please try again."));
      } finally {
        setSaving(false);
      }
    } else {
      setSaved(true);
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-5">
          {children}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="justify-end gap-3">
          {footerExtra}
          {saved && !error && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="size-4" aria-hidden="true" />
              Saved
            </span>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
