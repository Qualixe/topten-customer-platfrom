import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  /** Pass `reset` from Next.js error boundary props to wire up the retry button. */
  onRetry?: () => void;
  className?: string;
}

/**
 * Reusable error state for data-fetching failures. Render inside a Card's
 * CardContent, or stand-alone inside a section.
 */
export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this data. It might be a temporary issue.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-10 text-center",
        className
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle
          className="size-6 text-destructive"
          aria-hidden="true"
        />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>

      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
      )}
    </div>
  );
}
