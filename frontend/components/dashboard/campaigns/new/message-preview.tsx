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
  };
}

/** Supported personalisation tokens, their display label, and the tooltip
 * shown when hovering the insert button. */
export const PERSONALIZATION_TOKENS: { token: string; label: string; description: string }[] = [
  {
    token: "{{customer_name}}",
    label: "Customer name",
    description: "Insert Customer name — replaced with each recipient's actual name",
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
}: {
  message: string;
  senderName?: string;
}) {
  const resolved = resolveTokens(message);
  const isEmpty = message.trim().length === 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Live preview
      </p>

      {/* Phone frame */}
      <div className="relative mx-auto w-56 rounded-[2rem] border-4 border-foreground/20 bg-background shadow-xl">
        {/* Speaker notch */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-foreground/20" />
        </div>

        {/* Screen */}
        <div className="bg-muted/30 px-3 pb-6 pt-2 min-h-[14rem]">
          {/* Sender name */}
          <p className="mb-3 text-center text-[10px] font-semibold text-muted-foreground">
            {senderName}
          </p>

          {/* Message bubble */}
          <div className="flex justify-start">
            <div
              className={cn(
                "max-w-[90%] rounded-2xl rounded-tl-sm px-3 py-2 text-[11px] leading-relaxed break-words whitespace-pre-wrap",
                isEmpty
                  ? "border border-dashed border-border text-muted-foreground italic"
                  : "bg-card ring-1 ring-foreground/10 text-card-foreground"
              )}
            >
              {isEmpty ? "Your message will appear here…" : resolved}
            </div>
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
