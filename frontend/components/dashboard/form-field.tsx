import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

export function FormField({
  htmlFor,
  label,
  description,
  children,
}: {
  htmlFor: string;
  label: ReactNode;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
