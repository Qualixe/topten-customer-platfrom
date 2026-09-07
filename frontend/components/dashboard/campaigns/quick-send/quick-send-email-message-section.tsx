"use client";

import { useEffect, useState } from "react";
import { LayoutTemplate, Mail } from "lucide-react";

import { FormField } from "@/components/dashboard/form-field";
import { MessagePreview } from "@/components/dashboard/campaigns/new/message-preview";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getMailchimpTemplateSections,
  listMailchimpTemplates,
  type MailchimpTemplate,
} from "@/lib/api/mailchimp";
import { listTemplates, type MessageTemplate } from "@/lib/api/templates";

interface QuickSendEmailMessageSectionProps {
  subject: string;
  onSubjectChange: (value: string) => void;
  htmlBody: string;
  onHtmlBodyChange: (value: string) => void;
  /** null when composing raw HTML — set once a Mailchimp template is
   * attached instead (see `mailchimpTemplateSections`). */
  mailchimpTemplateId: number | null;
  onMailchimpTemplateIdChange: (id: number | null) => void;
  mailchimpTemplateSections: Record<string, string>;
  onMailchimpTemplateSectionsChange: (sections: Record<string, string>) => void;
  /** Set once a campaign already exists — the chosen template (or the
   * choice to use raw HTML at all) is frozen at creation just like
   * campaign type/channel, so the mode toggle and template picker are
   * disabled; only the section content itself (or the HTML body) stays
   * editable. */
  templateLocked?: boolean;
}

function sectionLabel(name: string): string {
  return name.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Email counterpart to QuickSendMessageSection — subject + content
 * instead of an SMS message, no personalization tokens or Form attach
 * (the Mailchimp send path sends the body as-is, no {{token}}
 * substitution and no per-campaign landing page). Content is either raw
 * HTML (this app's own saved templates can pre-fill it) or a Mailchimp
 * template's named editable section(s) — its header/footer/design comes
 * from Mailchimp, designed once there; this only fills in the "middle". */
export function QuickSendEmailMessageSection({
  subject,
  onSubjectChange,
  htmlBody,
  onHtmlBodyChange,
  mailchimpTemplateId,
  onMailchimpTemplateIdChange,
  mailchimpTemplateSections,
  onMailchimpTemplateSectionsChange,
  templateLocked = false,
}: QuickSendEmailMessageSectionProps) {
  const [mode, setMode] = useState<"html" | "mailchimp-template">(
    mailchimpTemplateId !== null ? "mailchimp-template" : "html"
  );
  const isMailchimpTemplate = mode === "mailchimp-template";

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [importedTemplateId, setImportedTemplateId] = useState("");

  const [mailchimpTemplates, setMailchimpTemplates] = useState<MailchimpTemplate[]>([]);
  const [mailchimpTemplatesLoading, setMailchimpTemplatesLoading] = useState(false);
  const [mailchimpTemplatesError, setMailchimpTemplatesError] = useState<string | null>(null);
  const [sectionsLoading, setSectionsLoading] = useState(false);

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

  // Fetched lazily — only once the admin actually asks to use a Mailchimp
  // template, since it's a live call to Mailchimp's own API.
  useEffect(() => {
    if (!isMailchimpTemplate || mailchimpTemplates.length > 0) return;
    let cancelled = false;
    Promise.resolve().then(async () => {
      if (cancelled) return;
      setMailchimpTemplatesLoading(true);
      setMailchimpTemplatesError(null);
      try {
        const items = await listMailchimpTemplates();
        if (!cancelled) setMailchimpTemplates(items);
      } catch (err) {
        if (!cancelled) {
          setMailchimpTemplatesError(
            err instanceof Error ? err.message : "Unable to load Mailchimp templates."
          );
        }
      } finally {
        if (!cancelled) setMailchimpTemplatesLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMailchimpTemplate]);

  function switchMode(next: "html" | "mailchimp-template") {
    setMode(next);
    if (next === "html") {
      onMailchimpTemplateIdChange(null);
      onMailchimpTemplateSectionsChange({});
    }
  }

  async function selectMailchimpTemplate(templateId: string | null) {
    if (!templateId) return;
    const id = Number(templateId);
    setSectionsLoading(true);
    try {
      const sections = await getMailchimpTemplateSections(id);
      onMailchimpTemplateIdChange(id);
      onMailchimpTemplateSectionsChange(sections);
    } catch (err) {
      setMailchimpTemplatesError(
        err instanceof Error ? err.message : "Unable to load this template's content."
      );
    } finally {
      setSectionsLoading(false);
    }
  }

  function updateSection(name: string, value: string) {
    onMailchimpTemplateSectionsChange({ ...mailchimpTemplateSections, [name]: value });
  }

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

  const selectedMailchimpTemplate = mailchimpTemplates.find((t) => t.id === mailchimpTemplateId);
  const sectionNames = Object.keys(mailchimpTemplateSections);

  return (
    <div className="flex flex-col gap-3">
      {/* Content source toggle — locked once a campaign already exists,
       * same as Channel/Campaign type (see `templateLocked`). */}
      {templateLocked ? (
        <p className="text-xs text-muted-foreground">
          {isMailchimpTemplate
            ? "Using a Mailchimp template — locked after creation, but its content below is still editable."
            : "Written as raw HTML — locked after creation."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => switchMode("html")}
            aria-pressed={!isMailchimpTemplate}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              !isMailchimpTemplate
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border hover:border-primary/40 hover:bg-muted/50"
            )}
          >
            <Mail className={cn("size-4 shrink-0", !isMailchimpTemplate ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium">Write HTML</span>
              <span className="block text-xs text-muted-foreground">Compose the whole email here</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchMode("mailchimp-template")}
            aria-pressed={isMailchimpTemplate}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              isMailchimpTemplate
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border hover:border-primary/40 hover:bg-muted/50"
            )}
          >
            <LayoutTemplate className={cn("size-4 shrink-0", isMailchimpTemplate ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium">Use a Mailchimp template</span>
              <span className="block text-xs text-muted-foreground">
                Design header/footer in Mailchimp, fill in the rest here
              </span>
            </span>
          </button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-5">
        {/* Left: editor */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          {isMailchimpTemplate ? (
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Mailchimp template</CardTitle>
                <CardDescription>
                  Pick a template designed in Mailchimp, then edit just its content area(s) below
                  — the header, footer, and overall design come from the template itself.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <FormField htmlFor="quick-send-email-subject" label="Subject">
                  <Input
                    id="quick-send-email-subject"
                    value={subject}
                    onChange={(e) => onSubjectChange(e.target.value)}
                    placeholder="e.g. This month's promotions"
                    required
                  />
                </FormField>

                <FormField htmlFor="quick-send-mailchimp-template" label="Template">
                  <Select
                    value={mailchimpTemplateId?.toString() ?? ""}
                    onValueChange={selectMailchimpTemplate}
                    disabled={
                      templateLocked || mailchimpTemplatesLoading || mailchimpTemplates.length === 0
                    }
                  >
                    <SelectTrigger id="quick-send-mailchimp-template" aria-label="Mailchimp template">
                      <SelectValue
                        placeholder={
                          mailchimpTemplatesLoading
                            ? "Loading templates…"
                            : mailchimpTemplates.length === 0
                              ? "No templates found in Mailchimp"
                              : "Choose a template…"
                        }
                      >
                        {() => selectedMailchimpTemplate?.name ?? "Choose a template…"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {mailchimpTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mailchimpTemplatesError && (
                    <p className="text-xs text-destructive">{mailchimpTemplatesError}</p>
                  )}
                </FormField>

                {sectionsLoading && (
                  <p className="text-sm text-muted-foreground">Loading template content…</p>
                )}

                {!sectionsLoading && mailchimpTemplateId !== null && sectionNames.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    This template has no editable content area — it&apos;ll send exactly as
                    designed in Mailchimp.
                  </p>
                )}

                {!sectionsLoading &&
                  sectionNames.map((name) => (
                    <FormField
                      key={name}
                      htmlFor={`quick-send-mailchimp-section-${name}`}
                      label={sectionLabel(name)}
                    >
                      <Textarea
                        id={`quick-send-mailchimp-section-${name}`}
                        value={mailchimpTemplateSections[name]}
                        onChange={(e) => updateSection(name, e.target.value)}
                        className="min-h-32 resize-y font-mono text-sm"
                      />
                    </FormField>
                  ))}
              </CardContent>
            </Card>
          ) : (
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
          )}
        </div>

        {/* Right: preview */}
        <div className="hidden lg:col-span-2 lg:block">
          {isMailchimpTemplate ? (
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 items-center justify-center py-2 text-center text-sm text-muted-foreground">
                A live preview isn&apos;t available for a Mailchimp template — the header, footer,
                and design come from Mailchimp, so check the real rendered result there (or via a
                test send from the Marketing page) before sending.
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Live Preview</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 items-center justify-center py-2">
                <MessagePreview message={htmlBody} channel="EMAIL" subject={subject} hideLabel />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Mobile preview */}
      {!isMailchimpTemplate && (
        <div className="lg:hidden">
          <MessagePreview message={htmlBody} channel="EMAIL" subject={subject} />
        </div>
      )}
    </div>
  );
}
