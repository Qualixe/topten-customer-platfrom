import { Button } from "@/components/ui/button";
import type { FormField } from "@/lib/form-builder/types";

export function SubmitButtonField({ field }: { field: FormField }) {
  return (
    <Button type="button" className="w-full">
      {field.label || "Submit"}
    </Button>
  );
}
