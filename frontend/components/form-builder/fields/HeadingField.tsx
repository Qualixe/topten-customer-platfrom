import type { FormField } from "@/lib/form-builder/types";
import { cn } from "@/lib/utils";

const SIZE_CLASSES: Record<NonNullable<FormField["size"]>, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
};

export function HeadingField({ field }: { field: FormField }) {
  return (
    <p
      className={cn(
        "font-semibold",
        SIZE_CLASSES[field.size ?? "md"],
        field.align === "center" && "text-center",
        field.align === "right" && "text-right"
      )}
    >
      {field.label}
    </p>
  );
}
