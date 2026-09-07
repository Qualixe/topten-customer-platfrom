"use client";

import { useState } from "react";
import { Eye, Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";

import { FormField } from "@/components/dashboard/form-field";
import { MessagePreview } from "@/components/dashboard/campaigns/new/message-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getCampaignSendReadiness,
  previewCampaignEmail,
  sendCampaignEmail,
  updateCampaign,
  type SmsCampaign,
} from "@/lib/api/campaigns";
import { getErrorMessage } from "@/lib/api/types";

// A campaign can only be (re-)sent from one of these statuses — matches
// the backend's own gate (app.services.campaign_send_validation).
const SENDABLE_STATUSES = new Set(["DRAFT", "FAILED"]);

/** The only campaign-editing surface admins get for an EMAIL campaign — its
 * name, audience, type, recipients, and landing page are all system-
 * controlled and not editable here (or anywhere in the UI). Just the
 * subject/body, plus the three actions that move it forward: save the
 * draft, send a real test email to review, or send it for real. */
export function EmailBodyEditor({ initialCampaign }: { initialCampaign: SmsCampaign }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initialCampaign);
  const [subject, setSubject] = useState(initialCampaign.subject ?? "");
  const [body, setBody] = useState(initialCampaign.message);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [previewing, setPreviewing] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [checkingReadiness, setCheckingReadiness] = useState(false);
  const [readinessReasons, setReadinessReasons] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const locked = !SENDABLE_STATUSES.has(campaign.status);
  const dirty = subject !== (campaign.subject ?? "") || body !== campaign.message;

  async function handleSaveDraft() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const updated = await updateCampaign(campaign.id, { subject, message: body });
      setCampaign(updated);
      setSaveMessage("Draft saved.");
    } catch (err) {
      setSaveError(getErrorMessage(err, "Unable to save this draft. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    setPreviewing(true);
    setPreviewError(null);
    setPreviewMessage(null);
    try {
      await previewCampaignEmail(campaign.id);
      setPreviewMessage("Preview sent to your own inbox.");
    } catch (err) {
      setPreviewError(getErrorMessage(err, "Unable to send a preview. Please try again."));
    } finally {
      setPreviewing(false);
    }
  }

  async function openSendDialog() {
    setSendError(null);
    setSendDialogOpen(true);
    setCheckingReadiness(true);
    try {
      const readiness = await getCampaignSendReadiness(campaign.id);
      setReadinessReasons(readiness.reasons);
    } catch (err) {
      setReadinessReasons([
        getErrorMessage(err, "Unable to check whether this campaign is ready to send."),
      ]);
    } finally {
      setCheckingReadiness(false);
    }
  }

  async function handleSend() {
    setSending(true);
    setSendError(null);
    try {
      const updated = await sendCampaignEmail(campaign.id);
      setCampaign(updated);
      setSendDialogOpen(false);
      // The page header's status badge and the Edit/Landing-Page-Builder
      // buttons above this card are rendered by the server component —
      // refresh so they pick up the now-PROCESSING status too.
      router.refresh();
    } catch (err) {
      setSendError(getErrorMessage(err, "Unable to send this campaign. Please try again."));
    } finally {
      setSending(false);
    }
  }

  const canSend = !checkingReadiness && readinessReasons.length === 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Email content</CardTitle>
          <CardDescription>
            {locked
              ? "This campaign has already been sent or is currently sending — its content can no longer be edited."
              : "This is the only part of the campaign you can change — its name, audience, and recipients are set by the system."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="flex flex-col gap-4 lg:col-span-3">
              <FormField htmlFor="email-body-subject" label="Subject">
                <Input
                  id="email-body-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  disabled={locked}
                  placeholder="e.g. This month's promotions"
                />
              </FormField>

              <FormField htmlFor="email-body-message" label="Body (HTML)">
                <Textarea
                  id="email-body-message"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  disabled={locked}
                  className="min-h-64 resize-y font-mono text-sm"
                  placeholder="<p>Hello {{customer_name}}!</p>"
                />
              </FormField>
              <p className="text-xs text-muted-foreground">
                Supported tokens: <code>{"{{customer_name}}"}</code>, <code>{"{{profile_link}}"}</code>,{" "}
                <code>{"{{campaign_name}}"}</code>, <code>{"{{company_name}}"}</code>. Your logo and
                a consistent layout are added automatically when this sends.
              </p>
            </div>

            <div className="lg:col-span-2">
              <MessagePreview message={body} channel="EMAIL" subject={subject} />
            </div>
          </div>

          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          {saveMessage && !saveError && <p className="text-sm text-muted-foreground">{saveMessage}</p>}
          {previewError && <p className="text-sm text-destructive">{previewError}</p>}
          {previewMessage && !previewError && (
            <p className="text-sm text-muted-foreground">{previewMessage}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={locked || saving || !dirty}
            >
              <Save className="size-4" />
              {saving ? "Saving…" : "Save Email Draft"}
            </Button>
            <Button variant="outline" onClick={handlePreview} disabled={previewing || !body.trim()}>
              <Eye className="size-4" />
              {previewing ? "Sending preview…" : "Preview Email"}
            </Button>
            <Button onClick={openSendDialog} disabled={locked}>
              <Send className="size-4" />
              Send Campaign
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Send this campaign?</DialogTitle>
            <DialogDescription>
              This sends the email above to every recipient in this campaign&rsquo;s list right
              now. This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>

          {checkingReadiness && (
            <p className="text-sm text-muted-foreground">Checking whether this is ready to send…</p>
          )}

          {!checkingReadiness && readinessReasons.length > 0 && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="mb-1 text-sm font-medium text-destructive">Not ready to send yet:</p>
              <ul className="list-inside list-disc text-sm text-destructive">
                {readinessReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {!checkingReadiness && readinessReasons.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Everything checks out — {campaign.totalRecipients} recipient
              {campaign.totalRecipients === 1 ? "" : "s"} will receive this email.
            </p>
          )}

          {sendError && <p className="text-sm text-destructive">{sendError}</p>}

          <DialogFooter showCloseButton>
            <Button onClick={handleSend} disabled={!canSend || sending}>
              {sending ? "Sending…" : "Send Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
