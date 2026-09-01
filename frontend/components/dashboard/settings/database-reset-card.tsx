"use client";

import { useState } from "react";
import { AlertTriangle, Check, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/dashboard/form-field";
import { Input } from "@/components/ui/input";
import { resetDatabase, type DatabaseResetResult } from "@/lib/api/database-reset";
import { getErrorMessage } from "@/lib/api/types";

const CONFIRMATION_PHRASE = "RESET";

type Step = "warning" | "confirm" | "done";

export function DatabaseResetCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" aria-hidden="true" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Permanently wipes all customers, campaigns, imports, forms, gifts, deliveries, and
            message templates. User accounts, roles &amp; permissions, site settings, and API
            credentials (SMS gateway, Mailchimp, Pathao) are kept — you&apos;ll stay logged in and
            configured afterward. A safety backup is taken automatically right before wiping.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-end">
          <Button variant="destructive" onClick={() => setOpen(true)}>
            <Trash2 className="size-4" aria-hidden="true" />
            Reset Database
          </Button>
        </CardFooter>
      </Card>

      <ResetDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function ResetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<Step>("warning");
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DatabaseResetResult | null>(null);

  function reset() {
    setStep("warning");
    setTyped("");
    setSubmitting(false);
    setError(null);
    setResult(null);
  }

  async function handleConfirmReset() {
    setSubmitting(true);
    setError(null);
    try {
      const data = await resetDatabase(typed);
      setResult(data);
      setStep("done");
    } catch (err) {
      setError(getErrorMessage(err, "Reset failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        {step === "warning" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-destructive">This can&apos;t be undone</DialogTitle>
              <DialogDescription>
                You&apos;re about to permanently delete every customer, campaign, import, form,
                gift, and delivery record. A backup is taken first, but restoring from it requires
                server/database access — there&apos;s no undo button in the app.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter showCloseButton>
              <Button variant="destructive" onClick={() => setStep("confirm")}>
                I understand, continue
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-destructive">Confirm database reset</DialogTitle>
              <DialogDescription>
                Type <strong className="font-mono">{CONFIRMATION_PHRASE}</strong> below to confirm.
              </DialogDescription>
            </DialogHeader>

            <FormField htmlFor="reset-confirm-input" label={`Type "${CONFIRMATION_PHRASE}" to confirm`}>
              <Input
                id="reset-confirm-input"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder={CONFIRMATION_PHRASE}
                autoComplete="off"
                autoFocus
              />
            </FormField>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter showCloseButton>
              <Button
                variant="destructive"
                onClick={handleConfirmReset}
                disabled={typed !== CONFIRMATION_PHRASE || submitting}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {submitting ? "Resetting…" : "Reset Database"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "done" && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                Database reset
              </DialogTitle>
              <DialogDescription>
                All business data has been wiped. A backup was saved on the server as{" "}
                <span className="font-mono">{result.backupFile}</span>. Reload the page to clear
                any stale data still showing.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter showCloseButton>
              <Button onClick={() => window.location.reload()}>Reload Now</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
