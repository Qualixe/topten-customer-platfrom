"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCustomerType, type CustomerTypeOption } from "@/lib/api/customer-types";
import { getErrorMessage } from "@/lib/api/types";

const CREATE_NEW_VALUE = "__create_new_type__";

/** A Customer Type `<Select>` with a "Create new type…" row built into the
 * dropdown itself — picking it swaps the trigger for an inline name input,
 * so an admin never has to leave the form to add a type they're missing.
 * The separate "Manage Types" dialog (see manage-customer-types-dialog.tsx)
 * stays available alongside this for renaming/deactivating — this
 * component only ever adds. */
export function CustomerTypeSelect({
  id,
  options,
  types,
  onTypesChange,
  value,
  onChange,
  placeholder = "General",
}: {
  id: string;
  /** Already filtered by the caller (e.g. active-only, or active + the
   * customer's own current type) — what actually shows in the list. */
  options: CustomerTypeOption[];
  /** The full, unfiltered list — appended to when a new type is created. */
  types: CustomerTypeOption[];
  onTypesChange: (types: CustomerTypeOption[]) => void;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleValueChange(next: string | null) {
    if (next === CREATE_NEW_VALUE) {
      setNewName("");
      setError(null);
      setCreating(true);
      return;
    }
    onChange(next ?? "");
  }

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    try {
      const created = await createCustomerType(trimmed);
      onTypesChange([...types, created]);
      onChange(created.id);
      setCreating(false);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create this customer type."));
    } finally {
      setBusy(false);
    }
  }

  if (creating) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Input
            id={id}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleCreate();
              }
            }}
            placeholder="New customer type name"
            autoFocus
            disabled={busy}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={busy || !newName.trim()}
            onClick={handleCreate}
            aria-label="Create type"
          >
            <Check className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            onClick={() => setCreating(false)}
            aria-label="Cancel"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={handleValueChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue>
          {(current: string) => options.find((t) => t.id === current)?.name ?? placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((type) => (
          <SelectItem key={type.id} value={type.id}>
            {type.name}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={CREATE_NEW_VALUE}>
          <Plus className="size-3.5" aria-hidden="true" />
          Create new type…
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
