"use client";

import { useState, type FormEvent } from "react";
import { Check, ListTree, Pencil, Trash2, X } from "lucide-react";

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
import {
  createGiftCategory,
  deleteGiftCategory,
  updateGiftCategory,
  type GiftCategoryOption,
} from "@/lib/api/gifts";
import { getErrorMessage } from "@/lib/api/types";

function sortByName(categories: GiftCategoryOption[]): GiftCategoryOption[] {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name));
}

/** Lets an admin add, rename, or delete gift categories. Categories aren't a
 * fixed list, so this is the entry point for managing them — used from both
 * the catalog page (browsing) and the add/edit gift forms (so you don't have
 * to leave the form to create one you're missing). */
export function ManageCategoriesDialog({
  categories,
  onCategoriesChange,
}: {
  categories: GiftCategoryOption[];
  onCategoriesChange: (categories: GiftCategoryOption[]) => void;
}) {
  const [open, setOpen] = useState(false);
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
      const created = await createGiftCategory(trimmed);
      onCategoriesChange(sortByName([...categories, created]));
      setNewName("");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to add this category."));
    } finally {
      setBusy(false);
    }
  }

  function startEditing(category: GiftCategoryOption) {
    setError(null);
    setEditingId(category.id);
    setEditingName(category.name);
  }

  async function handleRename(category: GiftCategoryOption) {
    const trimmed = editingName.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    try {
      const updated = await updateGiftCategory(category.id, trimmed);
      onCategoriesChange(
        sortByName(categories.map((existing) => (existing.id === updated.id ? updated : existing)))
      );
      setEditingId(null);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to rename this category."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(category: GiftCategoryOption) {
    if (!window.confirm(`Delete "${category.name}"? This can't be undone.`)) return;

    setBusy(true);
    setError(null);
    try {
      await deleteGiftCategory(category.id);
      onCategoriesChange(categories.filter((existing) => existing.id !== category.id));
    } catch (err) {
      setError(getErrorMessage(err, "Unable to delete this category."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <ListTree className="size-3.5" aria-hidden="true" />
            Manage Categories
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
          <DialogDescription>Add, rename, or remove gift categories.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="New category name"
            disabled={busy}
            aria-label="New category name"
          />
          <Button type="submit" disabled={busy || !newName.trim()}>
            Add
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {categories.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No categories yet.</p>
          )}
          {categories.map((category) => (
            <div key={category.id} className="flex items-center gap-1.5 rounded-md px-1 py-1.5">
              {editingId === category.id ? (
                <>
                  <Input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    disabled={busy}
                    autoFocus
                    className="h-8"
                    aria-label={`Rename ${category.name}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy || !editingName.trim()}
                    onClick={() => handleRename(category)}
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
                  <span className="flex-1 truncate text-sm">{category.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    onClick={() => startEditing(category)}
                    aria-label={`Rename ${category.name}`}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    onClick={() => handleDelete(category)}
                    aria-label={`Delete ${category.name}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
