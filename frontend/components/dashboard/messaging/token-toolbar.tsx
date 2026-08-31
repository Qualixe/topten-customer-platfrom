"use client";

import { Sparkles } from "lucide-react";
import type { RefObject } from "react";

import { PERSONALIZATION_TOKENS } from "@/components/dashboard/campaigns/new/message-preview";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Buttons that insert a `{{token}}` personalization placeholder at the
 * current cursor position of a controlled textarea. Shared by the campaign
 * wizard's message step and the message template form — both compose the
 * same kind of body text.
 */
export function TokenToolbar({
  value,
  onChange,
  textareaRef,
}: {
  value: string;
  onChange: (next: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  function insertToken(token: string) {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);

    // Restore focus and move cursor to end of inserted token
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Personalisation
      </p>
      <TooltipProvider>
        <div className="flex flex-wrap gap-2">
          {PERSONALIZATION_TOKENS.map(({ token, description }) => (
            <Tooltip key={token}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => insertToken(token)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary/50 bg-primary/5 px-2.5 py-1 text-xs font-mono font-medium text-primary transition-colors hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Sparkles className="size-3" aria-hidden="true" />
                    {token}
                  </button>
                }
              />
              <TooltipContent>{description}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
