"use client";

import { CheckCircle2, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { attachFormToCampaign } from "@/lib/api/forms";
import { listCampaigns, type SmsCampaign } from "@/lib/api/campaigns";
import { getErrorMessage } from "@/lib/api/types";

/** Copies this form's fields into a campaign's landing page so it can
 * actually be sent via SMS — reuses the existing campaign landing page
 * builder/publish/token/verification pipeline; this dialog is just a
 * shortcut for "create/replace that campaign's landing page from this
 * form" instead of rebuilding it block by block. */
export function AttachToCampaignDialog({
  formId,
  trigger,
}: {
  formId: string;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<SmsCampaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ campaignId: string; skippedFieldLabels: string[] } | null>(
    null
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listCampaigns({ pageSize: 100 })
      .then((page) => {
        if (!cancelled) setCampaigns(page.items);
      })
      .catch(() => {
        if (!cancelled) setCampaigns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function reset() {
    setCampaignId("");
    setError(null);
    setResult(null);
  }

  async function handleSubmit() {
    if (!campaignId) return;
    setSubmitting(true);
    setError(null);
    try {
      const attachResult = await attachFormToCampaign(formId, campaignId);
      setResult({ campaignId, skippedFieldLabels: attachResult.skippedFieldLabels });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to attach this form to that campaign. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button type="button" variant="outline">
              <Send className="size-4" />
              Send via Campaign
            </Button>
          )
        }
      />

      <DialogContent className="sm:max-w-md">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-primary" />
                Attached
              </DialogTitle>
              <DialogDescription>
                This form is now that campaign&apos;s landing page (unpublished). Review it, publish it,
                then send the campaign.
              </DialogDescription>
            </DialogHeader>

            {result.skippedFieldLabels.length > 0 && (
              <p className="text-sm text-muted-foreground">
                These fields aren&apos;t supported on campaign landing pages yet and were left out:{" "}
                <strong>{result.skippedFieldLabels.join(", ")}</strong>.
              </p>
            )}

            <DialogFooter showCloseButton>
              <Button
                type="button"
                nativeButton={false}
                render={<Link href={`/dashboard/campaigns/${result.campaignId}/builder`} />}
              >
                Open Landing Page Builder
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Send via Campaign</DialogTitle>
              <DialogDescription>
                Pick a campaign — this form&apos;s fields become that campaign&apos;s landing page, ready
                to publish and send.
              </DialogDescription>
            </DialogHeader>

            <Select value={campaignId} onValueChange={(value) => setCampaignId(value ?? "")}>
              <SelectTrigger aria-label="Choose a campaign">
                <SelectValue placeholder="Choose a campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" onClick={handleSubmit} disabled={!campaignId || submitting}>
                {submitting ? "Attaching…" : "Attach to Campaign"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
