import { cn } from "@/lib/utils";

/** The real site origin the form link would actually use once sent — this
 * component only ever mounts after the user has clicked through the
 * campaign wizard to the Message step, well past hydration, so `window`
 * is always available here (no SSR/hydration-mismatch risk). Falls back
 * to a clearly-fake placeholder only in the ssr-render edge case. */
function previewOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "https://your-site.example";
}

/** Sample recipient used when rendering token substitution in the preview —
 * a real domain (not a fake "topten.example" placeholder) so what's shown
 * actually matches what a recipient's SMS link would look like. */
function previewRecipient(): Record<string, string> {
  return {
    customer_name: "Amelia Chowdhury",
    form_link: `${previewOrigin()}/campaign/vip-profile?token=sample`,
    phone: "+8801711000101",
    email: "amelia@example.com",
    birthday: "March 15",
    current_date: new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
}

/** Supported personalisation tokens, their display label, and the tooltip
 * shown when hovering the insert button. Not offered: {{city}} (only a
 * free-text address is stored, no structured city field) and {{company}}
 * (no such concept on a Customer record) — neither has real data to
 * insert. */
export const PERSONALIZATION_TOKENS: { token: string; label: string; description: string }[] = [
  {
    token: "{{customer_name}}",
    label: "Customer name",
    description: "Insert Customer name — replaced with each recipient's actual name",
  },
  {
    token: "{{phone}}",
    label: "Phone",
    description: "Insert Phone — replaced with each recipient's phone number",
  },
  {
    token: "{{email}}",
    label: "Email",
    description:
      "Insert Email — replaced with each recipient's email address, when one is on file",
  },
  {
    token: "{{birthday}}",
    label: "Birthday",
    description:
      "Insert Birthday — replaced with each recipient's date of birth (e.g. March 15), when one is on file",
  },
  {
    token: "{{current_date}}",
    label: "Current date",
    description: "Insert Current date — replaced with the date the message is actually sent",
  },
  {
    token: "{{form_link}}",
    label: "Form link",
    description:
      "Insert Form link — replaced with each recipient's secure link to the attached form. Only works if this campaign has a published landing page (Campaign detail → Landing Page Builder); otherwise it's left blank.",
  },
];

/**
 * Replaces `{{token}}` placeholders in `message` with sample values so the
 * preview reflects what a real recipient would see.
 */
function resolveTokens(message: string): string {
  const recipient = previewRecipient();
  return message.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return recipient[key] ?? `{{${key}}}`;
  });
}

export function MessagePreview({
  message,
  senderName = "TopTen",
  channel = "SMS",
  subject = "",
  hideLabel = false,
}: {
  message: string;
  senderName?: string;
  channel?: "SMS" | "EMAIL";
  /** Only rendered when channel is EMAIL. */
  subject?: string;
  /** Skip the internal "Live preview" label — for callers that already
   * show their own heading (e.g. a Card title) around this component. */
  hideLabel?: boolean;
}) {
  if (channel === "EMAIL") {
    return <EmailPreview subject={subject} body={message} fromName={senderName} hideLabel={hideLabel} />;
  }

  const resolved = resolveTokens(message);
  const isEmpty = message.trim().length === 0;

  return (
    <div className="flex flex-col items-center gap-3">
      {!hideLabel && (
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Live preview
        </p>
      )}

      {/* Phone frame */}
      <div className="relative mx-auto w-72 rounded-[2.5rem] border-4 border-foreground/20 bg-background shadow-xl">
        {/* Status bar */}
        <div className="flex items-center justify-between px-6 pt-3 text-[10px] font-medium text-muted-foreground">
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" />
            <span className="h-1.5 w-3 rounded-sm bg-foreground/40" />
          </span>
        </div>

        {/* Speaker notch */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-foreground/20" />
        </div>

        {/* Screen */}
        <div className="bg-muted/30 px-4 pb-8 pt-2 min-h-[18rem]">
          {/* Sender name */}
          <div className="mb-4 flex flex-col items-center gap-1">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {senderName.slice(0, 1).toUpperCase()}
            </span>
            <p className="text-[11px] font-semibold text-muted-foreground">{senderName}</p>
          </div>

          {/* Message bubble */}
          <div className="flex flex-col items-start gap-1">
            <div
              className={cn(
                "max-w-[85%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[12px] leading-relaxed break-words whitespace-pre-wrap shadow-sm",
                isEmpty
                  ? "border border-dashed border-border text-muted-foreground italic shadow-none"
                  : "bg-card ring-1 ring-foreground/10 text-card-foreground"
              )}
            >
              {isEmpty ? "Your message will appear here…" : resolved}
            </div>
            {!isEmpty && (
              <span className="px-1 text-[10px] text-muted-foreground">Delivered · just now</span>
            )}
          </div>
        </div>

        {/* Home bar */}
        <div className="flex justify-center py-2">
          <div className="h-1 w-12 rounded-full bg-foreground/20" />
        </div>
      </div>

      {/* Token legend */}
      {!isEmpty && message.includes("{{") && (
        <p className="text-center text-xs text-muted-foreground">
          Tokens shown with sample values
        </p>
      )}
    </div>
  );
}

function EmailPreview({
  subject,
  body,
  fromName,
  hideLabel = false,
}: {
  subject: string;
  body: string;
  fromName: string;
  hideLabel?: boolean;
}) {
  const resolvedSubject = resolveTokens(subject);
  const resolvedBody = resolveTokens(body);
  const isEmpty = body.trim().length === 0;

  return (
    <div className="flex flex-col items-center gap-3">
      {!hideLabel && (
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Live preview
        </p>
      )}

      <div className="mx-auto w-72 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="border-b border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">From: {fromName}</p>
          <p className="mt-1 text-sm font-semibold text-card-foreground">
            {subject.trim() ? resolvedSubject : "(no subject)"}
          </p>
        </div>
        <div className="min-h-[14rem] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words">
          {isEmpty ? (
            <span className="text-muted-foreground italic">Your message will appear here…</span>
          ) : (
            resolvedBody
          )}
        </div>
      </div>

      {!isEmpty && (subject.includes("{{") || body.includes("{{")) && (
        <p className="text-center text-xs text-muted-foreground">
          Tokens shown with sample values
        </p>
      )}
    </div>
  );
}
