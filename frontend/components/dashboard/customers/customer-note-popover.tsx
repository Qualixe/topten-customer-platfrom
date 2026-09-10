"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StickyNote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { updateCustomer, type Customer } from "@/lib/api/customers";
import { getErrorMessage } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** Quick view/edit access to a customer's internal note, right from the
 * customers table — a full Edit Customer dialog is overkill just to jot or
 * check a note. Filled icon = a note already exists, outline = none yet. */
export function CustomerNotePopover({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(customer.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateCustomer(customer.id, { internalNotes: value.trim() || null });
      router.refresh();
      setOpen(false);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to save. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setValue(customer.notes);
      setError(null);
    }
  }

  const hasNote = customer.notes.trim().length > 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={
              hasNote ? `View/edit note for ${customer.name}` : `Add note for ${customer.name}`
            }
          />
        }
      >
        <StickyNote className={cn(hasNote && "fill-current")} />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`customer-note-${customer.id}`}>Internal Note</Label>
          <Textarea
            id={`customer-note-${customer.id}`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="min-h-24 resize-none text-sm"
            placeholder="Staff-only — never shown to the customer."
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
