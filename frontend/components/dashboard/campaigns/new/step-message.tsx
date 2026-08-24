"use client";

import { useRef } from "react";
import { Sparkles } from "lucide-react";

import { FormField } from "@/components/dashboard/form-field";
import { MessageAnalysisBar } from "@/components/dashboard/campaigns/new/message-analysis-bar";
import { MessagePreview, PERSONALIZATION_TOKENS } from "@/components/dashboard/campaigns/new/message-preview";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { analyzeSmsMessage } from "@/lib/sms";

interface StepMessageProps {
  message: string;
  onMessageChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepMessage({
  message,
  onMessageChange,
  onBack,
  onNext,
}: StepMessageProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const analysis = analyzeSmsMessage(message);

  /** Insert a token at the current cursor position in the textarea. */
  function insertToken(token: string) {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const next =
      message.slice(0, start) + token + message.slice(end);
    onMessageChange(next);

    // Restore focus and move cursor to end of inserted token
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        {/* Left: editor */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Write your message</CardTitle>
              <CardDescription>
                Compose the SMS that will be sent to your audience. Use
                personalisation tokens to address each customer by name.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Personalisation tokens */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Personalisation
                </p>
                <TooltipProvider>
                  <div className="flex flex-wrap gap-2">
                    {PERSONALIZATION_TOKENS.map(({ token, label }) => (
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
                        <TooltipContent>
                          Insert {label} — replaced with each recipient&apos;s
                          actual {label.toLowerCase()}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>
              </div>

              <Separator />

              {/* Textarea */}
              <FormField htmlFor="campaign-message" label="Message body">
                <Textarea
                  ref={textareaRef}
                  id="campaign-message"
                  value={message}
                  onChange={(e) => onMessageChange(e.target.value)}
                  placeholder="Type your SMS message here, or click a token above to personalise it…"
                  className="min-h-32 resize-y font-mono text-sm"
                  autoFocus
                />
              </FormField>

              {/* Live analysis */}
              <MessageAnalysisBar analysis={analysis} />
            </CardContent>
          </Card>
        </div>

        {/* Right: phone preview */}
        <div className="hidden lg:flex lg:items-start">
          <MessagePreview message={message} />
        </div>
      </div>

      {/* Mobile preview */}
      <div className="lg:hidden">
        <MessagePreview message={message} />
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!message.trim()}>
          Continue to Review
        </Button>
      </div>
    </div>
  );
}
