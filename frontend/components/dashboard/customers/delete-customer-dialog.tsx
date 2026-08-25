"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteCustomer, type Customer } from "@/lib/api/customers";
import { getErrorMessage } from "@/lib/api/types";

export function DeleteCustomerDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!customer) return;
    setDeleting(true);
    setError(null);

    try {
      await deleteCustomer(customer.id);
      router.refresh();
      onOpenChange(false);
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to reach the API server. Please try again.")
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        {customer && (
          <>
            <DialogHeader>
              <DialogTitle>Delete customer?</DialogTitle>
              <DialogDescription>
                This permanently removes <strong>{customer.name}</strong> and their spending
                history from the database. This can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter showCloseButton>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete Customer"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
