"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormField } from "@/components/dashboard/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  GIFT_CATEGORY_LABELS,
  updateGiftCatalogItem,
  type GiftCategory,
  type GiftItem,
} from "@/lib/api/gifts";
import { getErrorMessage } from "@/lib/api/types";

export function EditGiftDialog({
  gift,
  open,
  onOpenChange,
}: {
  gift: GiftItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {gift && (
          // Keying by id forces a fresh form instance (and initial state)
          // whenever a different row is opened into this shared dialog.
          <EditGiftForm key={gift.id} gift={gift} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditGiftForm({ gift, onClose }: { gift: GiftItem; onClose: () => void }) {
  const router = useRouter();

  const [name, setName] = useState(gift.name);
  const [category, setCategory] = useState<GiftCategory>(gift.category);
  const [description, setDescription] = useState(gift.description);
  const [pointsCost, setPointsCost] = useState(String(gift.pointsCost));
  const [retailValue, setRetailValue] = useState(String(gift.retailValue));
  const [stockQuantity, setStockQuantity] = useState(String(gift.stockQuantity));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await updateGiftCatalogItem(gift.id, {
        name,
        category,
        description,
        pointsCost: Number(pointsCost),
        retailValue: Number(retailValue),
        stockQuantity: Number(stockQuantity),
      });
      router.refresh();
      onClose();
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to reach the API server. Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Edit Gift</DialogTitle>
        <DialogDescription>Update {gift.name}&apos;s details.</DialogDescription>
      </DialogHeader>

      <FormField htmlFor="edit-gift-name" label="Name">
        <Input
          id="edit-gift-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </FormField>

      <FormField htmlFor="edit-gift-category" label="Category">
        <Select
          value={category}
          onValueChange={(value) => setCategory((value as GiftCategory) ?? category)}
        >
          <SelectTrigger id="edit-gift-category">
            <SelectValue>{(value: GiftCategory) => GIFT_CATEGORY_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(GIFT_CATEGORY_LABELS) as [GiftCategory, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </FormField>

      <FormField htmlFor="edit-gift-description" label="Description (optional)">
        <Textarea
          id="edit-gift-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="min-h-16 resize-none"
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField htmlFor="edit-gift-points" label="Points Cost">
          <Input
            id="edit-gift-points"
            type="number"
            min="0"
            value={pointsCost}
            onChange={(event) => setPointsCost(event.target.value)}
            required
          />
        </FormField>

        <FormField htmlFor="edit-gift-retail-value" label="Retail Value (৳)">
          <Input
            id="edit-gift-retail-value"
            type="number"
            min="0"
            step="0.01"
            value={retailValue}
            onChange={(event) => setRetailValue(event.target.value)}
            required
          />
        </FormField>

        <FormField htmlFor="edit-gift-stock" label="Stock Quantity">
          <Input
            id="edit-gift-stock"
            type="number"
            min="0"
            value={stockQuantity}
            onChange={(event) => setStockQuantity(event.target.value)}
            required
          />
        </FormField>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter showCloseButton>
        <Button type="submit" disabled={submitting || !name}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
