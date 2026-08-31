"use client";

import { useEffect, useRef, useState } from "react";

import { FormField } from "@/components/dashboard/form-field";
import { MessageAnalysisBar } from "@/components/dashboard/campaigns/new/message-analysis-bar";
import { MessagePreview } from "@/components/dashboard/campaigns/new/message-preview";
import { TokenToolbar } from "@/components/dashboard/messaging/token-toolbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { CampaignChannel } from "@/lib/api/campaigns";
import { listForms, type FormRecord } from "@/lib/api/forms";
import { listTemplates, type MessageTemplate } from "@/lib/api/templates";
import { analyzeSmsMessage } from "@/lib/sms";

interface StepMessageProps {
  channel: CampaignChannel;
  message: string;
  onMessageChange: (value: string) => void;
  subject: string;
  onSubjectChange: (value: string) => void;
  formId: string;
  onFormIdChange: (formId: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepMessage({
  channel,
  message,
  onMessageChange,
  subject,
  onSubjectChange,
  formId,
  onFormIdChange,
  onBack,
  onNext,
}: StepMessageProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const analysis = analyzeSmsMessage(message);
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);

  useEffect(() => {
    let cancelled = false;
    listForms({ pageSize: 100 })
      .then((page) => {
        if (!cancelled) setForms(page.items);
      })
      .catch(() => {
        if (!cancelled) setForms([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listTemplates({ channel, pageSize: 100 })
      .then((page) => {
        if (!cancelled) setTemplates(page.items);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [channel]);

  function applyTemplate(templateId: string | null) {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    onMessageChange(template.body);
    if (channel === "EMAIL" && template.subject) onSubjectChange(template.subject);
  }

  const usesFormLink = message.includes("{{form_link}}");
  const canContinue = message.trim().length > 0 && (channel === "SMS" || subject.trim().length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        {/* Left: editor */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Write your message</CardTitle>
              <CardDescription>
                {channel === "EMAIL"
                  ? "Compose the email that will be sent to your audience. Use personalisation tokens to address each customer by name."
                  : "Compose the SMS that will be sent to your audience. Use personalisation tokens to address each customer by name."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Import template — always shown; disabled with a hint when
               * no templates exist for this channel yet. */}
              <FormField htmlFor="campaign-start-from-template" label="Import from template">
                <Select
                  value=""
                  onValueChange={applyTemplate}
                  disabled={templates.length === 0}
                >
                  <SelectTrigger id="campaign-start-from-template" aria-label="Import from template">
                    <SelectValue
                      placeholder={
                        templates.length === 0
                          ? `No ${channel === "EMAIL" ? "email" : "SMS"} templates saved yet`
                          : "Choose a template to pre-fill this message…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Save reusable messages in{" "}
                    <a
                      href="/dashboard/templates"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Templates
                    </a>{" "}
                    to import them here.
                  </p>
                )}
              </FormField>

              {channel === "EMAIL" && (
                <FormField htmlFor="campaign-subject" label="Subject">
                  <Textarea
                    id="campaign-subject"
                    value={subject}
                    onChange={(e) => onSubjectChange(e.target.value)}
                    placeholder="e.g. This month's newsletter"
                    className="min-h-10 resize-none"
                    required
                  />
                </FormField>
              )}

              <TokenToolbar value={message} onChange={onMessageChange} textareaRef={textareaRef} />

              <Separator />

              {/* Textarea */}
              <FormField htmlFor="campaign-message" label="Message body">
                <Textarea
                  ref={textareaRef}
                  id="campaign-message"
                  value={message}
                  onChange={(e) => onMessageChange(e.target.value)}
                  placeholder={
                    channel === "EMAIL"
                      ? "Type your email body here, or click a token above to personalise it…"
                      : "Type your SMS message here, or click a token above to personalise it…"
                  }
                  className="min-h-32 resize-y font-mono text-sm"
                  autoFocus
                />
              </FormField>

              {/* Live analysis — SMS-specific segment/cost estimate, not
               * meaningful for EMAIL (no per-message cost model). */}
              {channel === "SMS" && <MessageAnalysisBar analysis={analysis} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Landing Page</CardTitle>
              <CardDescription>
                Attach a saved form so {"{{form_link}}"} becomes a real, working link once this
                campaign sends. Optional — skip this if the message doesn&apos;t need a link.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Select
                value={formId || "none"}
                onValueChange={(value) => onFormIdChange(value === "none" || !value ? "" : value)}
              >
                <SelectTrigger aria-label="Choose a form for the landing page">
                  <SelectValue placeholder="No landing page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No landing page</SelectItem>
                  {forms.map((form) => (
                    <SelectItem key={form.id} value={form.id}>
                      {form.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usesFormLink && !formId && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Your message uses {"{{form_link}}"} but no form is attached — it will be sent
                  literally as {"{{form_link}}"} instead of a real link.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: preview */}
        <div className="hidden lg:flex lg:items-start">
          <MessagePreview message={message} channel={channel} subject={subject} />
        </div>
      </div>

      {/* Mobile preview */}
      <div className="lg:hidden">
        <MessagePreview message={message} channel={channel} subject={subject} />
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!canContinue}>
          Continue to Review
        </Button>
      </div>
    </div>
  );
}
