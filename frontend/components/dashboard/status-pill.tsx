import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "accent";

const TONE_STYLES: Record<StatusTone, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  warning:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  danger:
    "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30",
  info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-400",
  neutral: "border-border bg-muted text-muted-foreground",
  accent:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-400",
};

const DOT_STYLES: Record<StatusTone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-destructive",
  info: "bg-sky-500",
  neutral: "bg-muted-foreground",
  accent: "bg-violet-500",
};

export function StatusPill({
  label,
  tone,
  loading = false,
}: {
  label: string;
  tone: StatusTone;
  loading?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_STYLES[tone]
      )}
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      ) : (
        <span
          className={cn("size-1.5 rounded-full", DOT_STYLES[tone])}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
}
