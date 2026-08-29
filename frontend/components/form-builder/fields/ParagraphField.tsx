import type { FormField } from "@/lib/form-builder/types";
import { cn } from "@/lib/utils";

export function ParagraphField({ field }: { field: FormField }) {
  return (
    <p
      className={cn(
        "text-sm text-muted-foreground",
        field.align === "center" && "text-center",
        field.align === "right" && "text-right"
      )}
    >
      {field.label}
    </p>
  );
}
