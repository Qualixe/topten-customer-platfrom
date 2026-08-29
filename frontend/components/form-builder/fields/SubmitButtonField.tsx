import { Button } from "@/components/ui/button";
import type { FormField } from "@/lib/form-builder/types";

export function SubmitButtonField({
  field,
  type = "button",
  disabled = false,
}: {
  field: FormField;
  /** "submit" only on the real public form (see FieldRenderer) — a builder
   * canvas/Preview button is always just a static, non-functional preview. */
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <Button type={type} disabled={disabled} className="h-12 w-full text-base">
      {field.label || "Submit"}
    </Button>
  );
}
