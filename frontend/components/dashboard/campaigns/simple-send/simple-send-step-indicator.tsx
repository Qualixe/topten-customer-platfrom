import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Audience & Message" },
  { id: 2, label: "Review & Send" },
] as const;

export type SimpleSendStepId = (typeof STEPS)[number]["id"];

/** A 2-step version of the wizard's StepIndicator, for the middle-ground
 * campaign flow between the full 4-step builder and the single-page Quick
 * Send composer. */
export function SimpleSendStepIndicator({ current }: { current: SimpleSendStepId }) {
  return (
    <nav aria-label="Campaign steps">
      <ol className="flex items-center gap-0">
        {STEPS.map((step, index) => {
          const isCompleted = step.id < current;
          const isCurrent = step.id === current;
          const isLast = index === STEPS.length - 1;

          return (
            <li key={step.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5 px-3">
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                    isCompleted && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary bg-background text-primary ring-4 ring-primary/20",
                    !isCompleted && !isCurrent && "border-border bg-background text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="size-3.5" aria-hidden="true" /> : step.id}
                </span>
                <span
                  className={cn(
                    "hidden text-xs font-medium sm:block",
                    isCurrent
                      ? "text-foreground"
                      : isCompleted
                        ? "text-muted-foreground"
                        : "text-muted-foreground/60"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {!isLast && (
                <div
                  className={cn(
                    "h-px w-8 transition-colors md:w-16",
                    step.id < current ? "bg-primary" : "bg-border"
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
