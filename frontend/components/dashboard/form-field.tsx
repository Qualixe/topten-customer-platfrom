import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function FormField({
  htmlFor,
  label,
  description,
  children,
  className,
}: {
  htmlFor: string;
  label: ReactNode;
  description?: string;
  children: ReactNode;
  /** e.g. "col-span-2" when this field spans a full row inside a grid form. */
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
