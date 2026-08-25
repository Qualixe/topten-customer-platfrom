"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";

import { FormField } from "@/components/dashboard/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { createGiftCatalogItem, GIFT_CATEGORY_LABELS, type GiftCategory } from "@/lib/api/gifts";
import { getErrorMessage } from "@/lib/api/types";

export function AddGiftDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus />
            Add Gift
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Gift</DialogTitle>
          <DialogDescription>Adds a new item to the gift catalog.</DialogDescription>
        </DialogHeader>

        <AddGiftForm onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddGiftForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<GiftCategory>("FOOD_AND_BEVERAGE");
  const [description, setDescription] = useState("");
  const [pointsCost, setPointsCost] = useState("");
  const [retailValue, setRetailValue] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await createGiftCatalogItem({
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
      <FormField htmlFor="add-gift-name" label="Name">
        <Input
          id="add-gift-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Premium Tea Gift Box"
          required
        />
      </FormField>

      <FormField htmlFor="add-gift-category" label="Category">
        <Select
          value={category}
          onValueChange={(value) => setCategory((value as GiftCategory) ?? "FOOD_AND_BEVERAGE")}
        >
          <SelectTrigger id="add-gift-category">
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

      <FormField htmlFor="add-gift-description" label="Description (optional)">
        <Textarea
          id="add-gift-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="min-h-16 resize-none"
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField htmlFor="add-gift-points" label="Points Cost">
          <Input
            id="add-gift-points"
            type="number"
            min="0"
            value={pointsCost}
            onChange={(event) => setPointsCost(event.target.value)}
            required
          />
        </FormField>

        <FormField htmlFor="add-gift-retail-value" label="Retail Value (৳)">
          <Input
            id="add-gift-retail-value"
            type="number"
            min="0"
            step="0.01"
            value={retailValue}
            onChange={(event) => setRetailValue(event.target.value)}
            required
          />
        </FormField>

        <FormField htmlFor="add-gift-stock" label="Stock Quantity">
          <Input
            id="add-gift-stock"
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
        <Button type="submit" disabled={submitting || !name || !pointsCost || !retailValue}>
          {submitting ? "Adding…" : "Add Gift"}
        </Button>
      </DialogFooter>
    </form>
  );
}
