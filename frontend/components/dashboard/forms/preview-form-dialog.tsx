"use client";

import { FormPreview } from "@/components/form-builder/FormPreview";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FormRecord } from "@/lib/api/forms";

/** Read-only look at a form from the list page, without navigating into
 * the builder. Reuses the same FormPreview (and FieldRenderer underneath
 * it) the builder itself uses — no separate rendering logic. */
export function PreviewFormDialog({
  form,
  open,
  onOpenChange,
}: {
  form: FormRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {form && (
          <>
            <DialogHeader>
              <DialogTitle>{form.name}</DialogTitle>
            </DialogHeader>
            <FormPreview fields={form.builderData.fields} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
