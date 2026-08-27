import type { FormField } from "@/lib/form-builder/types";

export function ParagraphField({ field }: { field: FormField }) {
  return <p className="text-sm text-muted-foreground">{field.label}</p>;
}
