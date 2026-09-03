"use client";

import { useState, type FormEvent } from "react";
import { Check, ListTree, Lock, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  createCustomerType,
  setCustomerTypeActive,
  updateCustomerType,
  type CustomerTypeOption,
} from "@/lib/api/customer-types";
import { getErrorMessage } from "@/lib/api/types";

function sortByName(types: CustomerTypeOption[]): CustomerTypeOption[] {
  return [...types].sort((a, b) => a.name.localeCompare(b.name));
}

/** The add-form + row list shared by the compact dialog below and the full
 * Settings → Customers card (see customer-types-settings.tsx). There is no
 * delete — a type is retired by switching it inactive, which hides it from
 * pickers going forward without breaking any existing customer/import
 * batch that already references it. The three built-in types (General,
 * VIP, VVIP) are locked — campaign audience targeting resolves them by
 * exact name, so renaming or deactivating them isn't allowed. */
export function CustomerTypesManager({
  types,
  onTypesChange,
}: {
  types: CustomerTypeOption[];
  onTypesChange: (types: CustomerTypeOption[]) => void;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    try {
      const created = await createCustomerType(trimmed);
      onTypesChange(sortByName([...types, created]));
      setNewName("");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to add this customer type."));
    } finally {
      setBusy(false);
    }
  }

  function startEditing(type: CustomerTypeOption) {
    setError(null);
    setEditingId(type.id);
    setEditingName(type.name);
  }

  async function handleRename(type: CustomerTypeOption) {
    const trimmed = editingName.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    try {
      const updated = await updateCustomerType(type.id, trimmed);
      onTypesChange(
        sortByName(types.map((existing) => (existing.id === updated.id ? updated : existing)))
      );
      setEditingId(null);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to rename this customer type."));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(type: CustomerTypeOption, isActive: boolean) {
    setBusy(true);
    setError(null);
    try {
      const updated = await setCustomerTypeActive(type.id, isActive);
      onTypesChange(
        types.map((existing) => (existing.id === updated.id ? updated : existing))
      );
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update this customer type."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="New customer type name"
          disabled={busy}
          aria-label="New customer type name"
        />
        <Button type="submit" disabled={busy || !newName.trim()}>
          Add
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {types.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">No types yet.</p>
        )}
        {types.map((type) => (
          <div
            key={type.id}
            className="flex items-center gap-1.5 rounded-md px-1 py-1.5"
          >
            {editingId === type.id ? (
              <>
                <Input
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  disabled={busy}
                  autoFocus
                  className="h-8"
                  aria-label={`Rename ${type.name}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy || !editingName.trim()}
                  onClick={() => handleRename(type)}
                  aria-label="Save"
                >
                  <Check className="size-3.5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy}
                  onClick={() => setEditingId(null)}
                  aria-label="Cancel"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </Button>
              </>
            ) : (
              <>
                <span
                  className={`flex-1 truncate text-sm ${type.isActive ? "" : "text-muted-foreground"}`}
                >
                  {type.name}
                </span>
                {type.isSystem ? (
                  <span
                    className="flex items-center gap-1 px-2 text-xs text-muted-foreground"
                    title="Built-in type — can't be renamed or deactivated"
                  >
                    <Lock className="size-3" aria-hidden="true" />
                    Built-in
                  </span>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy}
                      onClick={() => startEditing(type)}
                      aria-label={`Rename ${type.name}`}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </Button>
                    <span className="flex items-center gap-1.5 pl-1">
                      <span className="text-xs text-muted-foreground">
                        {type.isActive ? "Active" : "Inactive"}
                      </span>
                      <Switch
                        checked={type.isActive}
                        onCheckedChange={(checked) => handleToggleActive(type, checked)}
                        disabled={busy}
                        aria-label={`${type.isActive ? "Deactivate" : "Activate"} ${type.name}`}
                      />
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Compact dialog wrapper around `CustomerTypesManager`, used inline from
 * the add/edit customer forms so an admin doesn't have to leave the form to
 * add a type they're missing. The full management surface lives in
 * Settings → Customers (see customer-types-settings.tsx). */
export function ManageCustomerTypesDialog({
  types,
  onTypesChange,
}: {
  types: CustomerTypeOption[];
  onTypesChange: (types: CustomerTypeOption[]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <ListTree className="size-3.5" aria-hidden="true" />
            Manage Types
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Customer Types</DialogTitle>
          <DialogDescription>
            Add, rename, or deactivate customer types. General, VIP, and VVIP are built in and
            can&apos;t be changed. Full management is also available in Settings →
            Customers.
          </DialogDescription>
        </DialogHeader>

        <CustomerTypesManager types={types} onTypesChange={onTypesChange} />
      </DialogContent>
    </Dialog>
  );
}
