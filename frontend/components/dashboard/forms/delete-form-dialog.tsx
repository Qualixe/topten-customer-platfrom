"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FormRecord } from "@/lib/form-builder/types";

export function DeleteFormDialog({
  form,
  open,
  onOpenChange,
  onConfirm,
}: {
  form: FormRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {form && (
          <>
            <DialogHeader>
              <DialogTitle>Delete form?</DialogTitle>
              <DialogDescription>
                This permanently removes <strong>{form.name}</strong> and its fields. This can&apos;t be
                undone.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter showCloseButton>
              <Button variant="destructive" onClick={onConfirm}>
                Delete Form
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
