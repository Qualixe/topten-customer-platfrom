"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { FormField } from "@/components/dashboard/form-field";
import { MessageAnalysisBar } from "@/components/dashboard/campaigns/new/message-analysis-bar";
import { MessagePreview } from "@/components/dashboard/campaigns/new/message-preview";
import { TokenToolbar } from "@/components/dashboard/messaging/token-toolbar";
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
import { listForms, type FormRecord } from "@/lib/api/forms";
import { listTemplates, type MessageTemplate } from "@/lib/api/templates";
import { analyzeSmsMessage } from "@/lib/sms";

interface QuickSendMessageSectionProps {
  message: string;
  onMessageChange: (value: string) => void;
  formId: string;
  onFormIdChange: (formId: string) => void;
}

/** Message section of the single-page Quick Send composer — same editor as
 * the wizard's StepMessage, minus the EMAIL branch (this composer is
 * SMS-only, matching StepDetails' own current default) and the
 * Back/Continue navigation, since every section is visible at once here. */
export function QuickSendMessageSection({
  message,
  onMessageChange,
  formId,
  onFormIdChange,
}: QuickSendMessageSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const analysis = analyzeSmsMessage(message);
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  // Tracked separately from message — that gets edited freely afterward,
  // but this just remembers which template was last imported so the
  // picker can show its name instead of resetting to the placeholder.
  const [importedTemplateId, setImportedTemplateId] = useState("");

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
    listTemplates({ channel: "SMS", pageSize: 100 })
      .then((page) => {
        if (!cancelled) setTemplates(page.items);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function applyTemplate(templateId: string | null) {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    onMessageChange(template.body);
    setImportedTemplateId(templateId ?? "");
  }

  const templateSelectPlaceholder =
    templates.length === 0
      ? "No SMS templates saved yet"
      : "Choose a template to pre-fill this message…";

  const usesFormLink = message.includes("{{form_link}}");

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-5">
        {/* Left: editor */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Write your message</CardTitle>
              {/* <CardDescription>
                Compose the SMS that will be sent to your audience. Use personalisation tokens to
                address each customer by name.
              </CardDescription> */}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex gap-4 sm:grid-cols-2 ">
                {/* Import template — always shown; disabled with a hint when
                 * no templates exist yet. */}
                <FormField htmlFor="quick-send-start-from-template" label="Import from template">
                  <Select
                    value={importedTemplateId}
                    onValueChange={applyTemplate}
                    disabled={templates.length === 0}
                  >
                    <SelectTrigger id="quick-send-start-from-template" aria-label="Import from template">
                      <SelectValue placeholder={templateSelectPlaceholder}>
                        {(value: string) =>
                          templates.find((template) => template.id === value)?.name ??
                          templateSelectPlaceholder
                        }
                      </SelectValue>
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
                      <Link
                        href="/dashboard/templates"
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        Templates
                      </Link>{" "}
                      to import them here.
                    </p>
                  )}
                </FormField>

                <FormField htmlFor="quick-send-form" label="Form">
                  <Select
                    value={formId || "none"}
                    onValueChange={(value) => onFormIdChange(value === "none" || !value ? "" : value)}
                  >
                    <SelectTrigger id="quick-send-form" aria-label="Choose a form">
                      <SelectValue placeholder="No form">
                        {(value: string) =>
                          value === "none" || !value
                            ? "No form"
                            : (forms.find((form) => form.id === value)?.name ?? "No form")
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No form</SelectItem>
                      {forms.map((form) => (
                        <SelectItem key={form.id} value={form.id}>
                          {form.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {usesFormLink && !formId ? (
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      Your message uses {"{{form_link}}"} but no form is attached
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Attach a saved form so {"{{form_link}}"} becomes a real, working link.
                    </p>
                  )}
                </FormField>
              </div>

              <TokenToolbar value={message} onChange={onMessageChange} textareaRef={textareaRef} />

              <Separator />

              <FormField htmlFor="quick-send-message" label="Message body">
                <Textarea
                  ref={textareaRef}
                  id="quick-send-message"
                  value={message}
                  onChange={(e) => onMessageChange(e.target.value)}
                  placeholder="Type your SMS message here, or click a token above to personalise it…"
                  className="min-h-32 resize-y font-mono text-sm"
                />
              </FormField>

              <MessageAnalysisBar analysis={analysis} />
            </CardContent>
          </Card>
        </div>

        {/* Right: preview */}
        <div className="hidden lg:col-span-2 lg:block">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Live Preview(Mobile view)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 items-center justify-center py-2">
              <MessagePreview message={message} channel="SMS" subject="" hideLabel />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile preview */}
      <div className="lg:hidden">
        <MessagePreview message={message} channel="SMS" subject="" />
      </div>
    </div>
  );
}
