"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Catches unhandled errors thrown during rendering inside the dashboard
 * layout segment — including async server component failures. Placed at the
 * /dashboard root so every sub-route (campaigns, customers, etc.) inherits
 * it without needing their own error.tsx.
 *
 * Next.js injects `error` (the thrown value) and `reset` (a function that
 * re-renders the segment to retry the failed render).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to your error-monitoring service here (e.g. Sentry.captureException)
    console.error("[dashboard error]", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-20 text-center">
      {/* Icon */}
      <span className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle
          className="size-7 text-destructive"
          aria-hidden="true"
        />
      </span>

      {/* Copy */}
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {error.message && error.message !== "An error occurred in the Server Components render."
            ? error.message
            : "We hit an unexpected error while loading this page. It might be a temporary glitch."}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60">
            Error ID: {error.digest}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => window.history.back()}>
          Go back
        </Button>
        <Button onClick={reset}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}
