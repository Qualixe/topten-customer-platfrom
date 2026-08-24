"use client";

import { RefreshCw, Store } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Only genuine failures (API unreachable, unexpected 5xx) land here — an
 * invalid/expired/revoked token is handled by not-found.tsx instead. Never
 * shows the underlying error/message, per the "no technical errors" rule. */
export default function CustomerProfileError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Store className="size-4" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">Please try again.</p>
      </div>
      <Button onClick={reset} className="h-11 gap-1.5">
        <RefreshCw className="size-4" aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}
