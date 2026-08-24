import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Optional CTA button or link rendered below the copy. */
  action?: ReactNode;
  className?: string;
}

/**
 * Reusable empty state for tables, lists, and cards with no data.
 * Drop it inside a table's <TableBody> via a colSpan cell, or stand-alone
 * inside a CardContent.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 py-12 text-center",
        className
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
