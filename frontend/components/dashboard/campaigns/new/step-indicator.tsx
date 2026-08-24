import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export const STEPS = [
  { id: 1, label: "Details" },
  { id: 2, label: "Audience" },
  { id: 3, label: "Message" },
  { id: 4, label: "Review" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

export function StepIndicator({
  current,
  onStepClick,
  maxReached,
}: {
  current: StepId;
  onStepClick: (step: StepId) => void;
  maxReached: StepId;
}) {
  return (
    <nav aria-label="Campaign setup steps">
      <ol className="flex items-center gap-0">
        {STEPS.map((step, index) => {
          const isCompleted = step.id < current;
          const isCurrent = step.id === current;
          const isReachable = step.id <= maxReached;
          const isLast = index === STEPS.length - 1;

          return (
            <li key={step.id} className="flex items-center">
              <button
                type="button"
                onClick={() => isReachable && onStepClick(step.id)}
                disabled={!isReachable}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1.5 px-3 disabled:cursor-not-allowed disabled:opacity-40",
                  isReachable && !isCurrent && "cursor-pointer"
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                    isCompleted &&
                      "border-primary bg-primary text-primary-foreground",
                    isCurrent &&
                      "border-primary bg-background text-primary ring-4 ring-primary/20",
                    !isCompleted &&
                      !isCurrent &&
                      "border-border bg-background text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    step.id
                  )}
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
              </button>

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
