"use client";

import { useEffect, useState } from "react";

import { FormField } from "@/components/dashboard/form-field";
import { MessagePreview } from "@/components/dashboard/campaigns/new/message-preview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { listTemplates, type MessageTemplate } from "@/lib/api/templates";

interface QuickSendEmailMessageSectionProps {
  subject: string;
  onSubjectChange: (value: string) => void;
  htmlBody: string;
  onHtmlBodyChange: (value: string) => void;
}

/** Email counterpart to QuickSendMessageSection — subject + raw HTML body
 * instead of an SMS message. TopTen owns the whole email layout/design
 * (see backend app.services.campaign_email); Mailchimp is only ever the
 * delivery provider, so there's no "attach a Mailchimp template" option
 * here — just this app's own saved templates as an optional starting
 * point. */
export function QuickSendEmailMessageSection({
  subject,
  onSubjectChange,
  htmlBody,
  onHtmlBodyChange,
}: QuickSendEmailMessageSectionProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [importedTemplateId, setImportedTemplateId] = useState("");

  useEffect(() => {
    let cancelled = false;
    listTemplates({ channel: "EMAIL", pageSize: 100 })
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
    onSubjectChange(template.subject ?? "");
    onHtmlBodyChange(template.body);
    setImportedTemplateId(templateId ?? "");
  }

  const templateSelectPlaceholder =
    templates.length === 0
      ? "No email templates saved yet"
      : "Choose a template to pre-fill this message…";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-5">
        {/* Left: editor */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Write your email</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FormField htmlFor="quick-send-email-template" label="Import from template">
                <Select
                  value={importedTemplateId}
                  onValueChange={applyTemplate}
                  disabled={templates.length === 0}
                >
                  <SelectTrigger id="quick-send-email-template" aria-label="Import from template">
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
              </FormField>

              <FormField htmlFor="quick-send-email-subject" label="Subject">
                <Input
                  id="quick-send-email-subject"
                  value={subject}
                  onChange={(e) => onSubjectChange(e.target.value)}
                  placeholder="e.g. This month's promotions"
                  required
                />
              </FormField>

              <FormField htmlFor="quick-send-email-body" label="Email body (HTML)">
                <Textarea
                  id="quick-send-email-body"
                  value={htmlBody}
                  onChange={(e) => onHtmlBodyChange(e.target.value)}
                  placeholder="<p>Hello!</p>"
                  className="min-h-48 resize-y font-mono text-sm"
                />
              </FormField>
            </CardContent>
          </Card>
        </div>

        {/* Right: preview */}
        <div className="hidden lg:col-span-2 lg:block">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 items-center justify-center py-2">
              <MessagePreview message={htmlBody} channel="EMAIL" subject={subject} hideLabel />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile preview */}
      <div className="lg:hidden">
        <MessagePreview message={htmlBody} channel="EMAIL" subject={subject} />
      </div>
    </div>
  );
}
