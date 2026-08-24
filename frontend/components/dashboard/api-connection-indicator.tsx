"use client";

import { useEffect, useState } from "react";

import { checkApiHealth } from "@/lib/api/health";
import { cn } from "@/lib/utils";

type ConnectionState = "checking" | "connected" | "unavailable";

const STATE_LABEL: Record<ConnectionState, string> = {
  checking: "Checking API…",
  connected: "Connected to API",
  unavailable: "API unavailable",
};

const STATE_CLASSES: Record<ConnectionState, string> = {
  checking: "border-muted-foreground/30 text-muted-foreground",
  connected: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  unavailable: "border-destructive/30 bg-destructive/10 text-destructive",
};

const DOT_CLASSES: Record<ConnectionState, string> = {
  checking: "bg-muted-foreground",
  connected: "bg-emerald-500",
  unavailable: "bg-destructive",
};

/**
 * Development-only badge that pings `GET /api/v1/health` once on mount.
 * Renders nothing when `NODE_ENV !== "development"`, so it never reaches
 * production — this is a debugging aid, not a permanent UI element.
 */
export function ApiConnectionIndicator() {
  const [state, setState] = useState<ConnectionState>("checking");

  useEffect(() => {
    let cancelled = false;

    checkApiHealth()
      .then(() => {
        if (!cancelled) setState("connected");
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <span
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex",
        STATE_CLASSES[state]
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT_CLASSES[state])} aria-hidden="true" />
      {STATE_LABEL[state]}
    </span>
  );
}
