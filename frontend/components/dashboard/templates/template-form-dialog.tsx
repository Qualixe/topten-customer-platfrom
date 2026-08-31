"use client";

import { useRef, useState, type FormEvent } from "react";

import { FormField } from "@/components/dashboard/form-field";
import { TokenToolbar } from "@/components/dashboard/messaging/token-toolbar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createTemplate,
  updateTemplate,
  type MessageTemplate,
  type TemplateCategory,
  type TemplateChannel,
} from "@/lib/api/templates";
import { getErrorMessage } from "@/lib/api/types";

const CHANNEL_LABELS: Record<TemplateChannel, string> = {
  SMS: "SMS",
  EMAIL: "Email",
};

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  GENERAL: "General",
  PROMOTIONAL: "Promotional",
  BIRTHDAY: "Birthday",
  VIP: "VIP",
  PROFILE_COMPLETION: "Profile Completion",
};

export function TemplateFormDialog({
  template,
  open,
  onOpenChange,
  onSaved,
}: {
  /** null creates a new template; a value edits it. Channel can't be
   * changed on an existing template — see app.views.message_templates. */
  template: MessageTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Keyed on which template (or "new") is open so the form
         * remounts fresh — rather than an effect resyncing state — every
         * time a different target opens; the dialog itself stays mounted
         * between opens. */}
        {open && (
          <TemplateForm key={template?.id ?? "new"} template={template} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplateForm({
  template,
  onSaved,
}: {
  template: MessageTemplate | null;
  onSaved: () => void;
}) {
  const isEdit = template !== null;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [name, setName] = useState(template?.name ?? "");
  const [channel, setChannel] = useState<TemplateChannel>(template?.channel ?? "SMS");
  const [category, setCategory] = useState<TemplateCategory>(template?.category ?? "GENERAL");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (isEdit) {
        await updateTemplate(template.id, {
          name,
          category,
          subject: channel === "EMAIL" ? subject : undefined,
          body,
        });
      } else {
        await createTemplate({ name, channel, category, subject, body });
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to save this template. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = name.trim() && body.trim() && (channel === "SMS" || subject.trim());

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit Template" : "New Template"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Changes only apply to future campaigns started from this template."
            : "A reusable starting point for SMS or Email campaigns."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField htmlFor="template-name" label="Name">
          <Input
            id="template-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Eid Promo"
            required
            autoFocus
          />
        </FormField>

        {/* Channel + Category: always 50/50 side by side */}
        <div className="grid grid-cols-2 gap-4">
          <FormField htmlFor="template-channel" label="Channel">
            <Select value={channel} onValueChange={(value) => setChannel(value as TemplateChannel)}>
              <SelectTrigger id="template-channel" disabled={isEdit} aria-label="Channel" className="w-full">
                <SelectValue>{(value: TemplateChannel) => CHANNEL_LABELS[value]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SMS">SMS</SelectItem>
                <SelectItem value="EMAIL">Email</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField htmlFor="template-category" label="Category">
            <Select value={category} onValueChange={(value) => setCategory(value as TemplateCategory)}>
              <SelectTrigger id="template-category" aria-label="Category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABELS) as TemplateCategory[]).map((key) => (
                  <SelectItem key={key} value={key}>{CATEGORY_LABELS[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        {/* Subject — only for EMAIL, full width */}
        {channel === "EMAIL" && (
          <FormField htmlFor="template-subject" label="Subject">
            <Input
              id="template-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. This month's newsletter"
              required
            />
          </FormField>
        )}

        <FormField htmlFor="template-body" label="Body">
          <Textarea
            ref={textareaRef}
            id="template-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Type the message body here, or click a token below to personalise it…"
            className="min-h-32 resize-y font-mono text-sm"
            required
          />
        </FormField>

        <TokenToolbar value={body} onChange={setBody} textareaRef={textareaRef} />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter showCloseButton>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
