import { LayoutTemplate } from "lucide-react";

import { FieldRenderer } from "@/components/form-builder/fields";
import { EmptyState } from "@/components/ui/empty-state";
import type { FormField } from "@/lib/form-builder/types";

/** Read-only-ish render of the form as a customer would see it — no
 * selection borders, no drag handles, inputs are enabled. Reuses the same
 * FieldRenderer as the canvas so nothing is rendered twice. */
export function FormPreview({ fields }: { fields: FormField[] }) {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-lg border bg-background p-8 shadow-sm">
      {fields.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="Nothing to preview"
          description="Go back and add some fields first."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {fields.map((field) => (
            <FieldRenderer key={field.id} field={field} preview />
          ))}
        </div>
      )}
    </div>
  );
}
