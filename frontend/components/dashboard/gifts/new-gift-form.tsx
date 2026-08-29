"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { FormField } from "@/components/dashboard/form-field";
import { GiftImageField } from "@/components/dashboard/gifts/gift-image-field";
import { ManageCategoriesDialog } from "@/components/dashboard/gifts/manage-categories-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createGiftCatalogItem,
  uploadGiftImage,
  type GiftCategoryOption,
} from "@/lib/api/gifts";
import { getErrorMessage } from "@/lib/api/types";

export function NewGiftForm({
  categories: initialCategories,
}: {
  categories: GiftCategoryOption[];
}) {
  const router = useRouter();

  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(initialCategories[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [retailValue, setRetailValue] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  function handleCategoriesChange(updated: GiftCategoryOption[]) {
    setCategories(updated);
    if (!updated.some((category) => category.id === categoryId)) {
      setCategoryId(updated[0]?.id ?? "");
    }
  }

  function handleImageSelected(file: File) {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  function handleImageRemove() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(null);
    setImagePreviewUrl(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const created = await createGiftCatalogItem({
        name,
        categoryId,
        description,
        retailValue: Number(retailValue),
        stockQuantity: Number(stockQuantity),
      });

      if (imageFile) {
        try {
          await uploadGiftImage(created.id, imageFile);
        } catch (err) {
          window.alert(
            getErrorMessage(
              err,
              "Gift was added, but the photo failed to upload. You can add one from this page."
            )
          );
        }
      }

      router.push(`/dashboard/gifts/${created.id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to reach the API server. Please try again."));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Gift details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <GiftImageField
            previewUrl={imagePreviewUrl}
            onSelectFile={handleImageSelected}
            onRemove={imagePreviewUrl ? handleImageRemove : undefined}
          />

          <FormField htmlFor="new-gift-name" label="Name">
            <Input
              id="new-gift-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Premium Tea Gift Box"
              required
            />
          </FormField>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="new-gift-category">Category</Label>
              <ManageCategoriesDialog
                categories={categories}
                onCategoriesChange={handleCategoriesChange}
              />
            </div>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No categories yet — use Manage Categories above to add one.
              </p>
            ) : (
              <Select value={categoryId} onValueChange={(value) => setCategoryId(value ?? "")}>
                <SelectTrigger id="new-gift-category">
                  <SelectValue>
                    {(value: string) =>
                      categories.find((category) => category.id === value)?.name ?? "Select a category"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <FormField htmlFor="new-gift-description" label="Description (optional)">
            <Textarea
              id="new-gift-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-20 resize-none"
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField htmlFor="new-gift-retail-value" label="Retail Value (৳)">
              <Input
                id="new-gift-retail-value"
                type="number"
                min="0"
                step="0.01"
                value={retailValue}
                onChange={(event) => setRetailValue(event.target.value)}
                required
              />
            </FormField>

            <FormField htmlFor="new-gift-stock" label="Stock Quantity">
              <Input
                id="new-gift-stock"
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(event) => setStockQuantity(event.target.value)}
                required
              />
            </FormField>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            render={<Link href="/dashboard/gifts" />}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !name || !categoryId || !retailValue}>
            {submitting ? "Adding…" : "Add Gift"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
