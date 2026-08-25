"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Clock, Gift as GiftIcon, Repeat2, Trash2 } from "lucide-react";

import { FormField } from "@/components/dashboard/form-field";
import { GiftImageField } from "@/components/dashboard/gifts/gift-image-field";
import { GiftStatusBadge } from "@/components/dashboard/gifts/gift-status-badge";
import { ManageCategoriesDialog } from "@/components/dashboard/gifts/manage-categories-dialog";
import { StockStatusBadge } from "@/components/dashboard/gifts/stock-status-badge";
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
  deleteGiftCatalogItem,
  formatCurrency,
  removeGiftImage,
  resolveGiftImageUrl,
  updateGiftCatalogItem,
  uploadGiftImage,
  type GiftCategoryOption,
  type GiftItem,
  type GiftOrder,
} from "@/lib/api/gifts";
import { getErrorMessage } from "@/lib/api/types";

function relativeTimeFrom(iso: string): string {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return "";

  const diffMs = Date.now() - created;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function GiftDetailView({
  gift,
  orders,
  categories: initialCategories,
  canManage,
}: {
  gift: GiftItem;
  orders: GiftOrder[];
  categories: GiftCategoryOption[];
  canManage: boolean;
}) {
  const router = useRouter();

  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState(gift.name);
  const [categoryId, setCategoryId] = useState(gift.category.id);
  const [description, setDescription] = useState(gift.description);
  const [pointsCost, setPointsCost] = useState(String(gift.pointsCost));
  const [retailValue, setRetailValue] = useState(String(gift.retailValue));
  const [stockQuantity, setStockQuantity] = useState(String(gift.stockQuantity));
  const [imageUrl, setImageUrl] = useState(gift.imageUrl);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCategoriesChange(updated: GiftCategoryOption[]) {
    setCategories(updated);
    if (!updated.some((category) => category.id === categoryId)) {
      setCategoryId(updated[0]?.id ?? "");
    }
  }

  async function handleImageSelected(file: File) {
    setImageBusy(true);
    setImageError(null);
    try {
      const updated = await uploadGiftImage(gift.id, file);
      setImageUrl(updated.imageUrl);
      router.refresh();
    } catch (err) {
      setImageError(getErrorMessage(err, "Unable to upload the photo. Please try again."));
    } finally {
      setImageBusy(false);
    }
  }

  async function handleImageRemove() {
    setImageBusy(true);
    setImageError(null);
    try {
      const updated = await removeGiftImage(gift.id);
      setImageUrl(updated.imageUrl);
      router.refresh();
    } catch (err) {
      setImageError(getErrorMessage(err, "Unable to remove the photo. Please try again."));
    } finally {
      setImageBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await updateGiftCatalogItem(gift.id, {
        name,
        categoryId,
        description,
        pointsCost: Number(pointsCost),
        retailValue: Number(retailValue),
        stockQuantity: Number(stockQuantity),
      });
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to reach the API server. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${gift.name}" from the catalog? This can't be undone.`)) return;
    setDeleting(true);
    try {
      await deleteGiftCatalogItem(gift.id);
      router.push("/dashboard/gifts");
    } catch (err) {
      window.alert(getErrorMessage(err, "Unable to delete this gift."));
      setDeleting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <form onSubmit={handleSubmit} className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Gift details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {canManage ? (
              <>
                <GiftImageField
                  previewUrl={resolveGiftImageUrl(imageUrl)}
                  onSelectFile={handleImageSelected}
                  onRemove={imageUrl ? handleImageRemove : undefined}
                  busy={imageBusy}
                />
                {imageError && <p className="text-sm text-destructive">{imageError}</p>}
              </>
            ) : (
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {resolveGiftImageUrl(imageUrl) ? (
                  <Image
                    src={resolveGiftImageUrl(imageUrl)!}
                    alt=""
                    width={64}
                    height={64}
                    unoptimized
                    className="size-full object-cover"
                  />
                ) : (
                  <GiftIcon className="size-6 text-muted-foreground" aria-hidden="true" />
                )}
              </span>
            )}

            <FormField htmlFor="gift-detail-name" label="Name">
              <Input
                id="gift-detail-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!canManage}
                required
              />
            </FormField>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="gift-detail-category">Category</Label>
                {canManage && (
                  <ManageCategoriesDialog
                    categories={categories}
                    onCategoriesChange={handleCategoriesChange}
                  />
                )}
              </div>
              <Select
                value={categoryId}
                onValueChange={(value) => setCategoryId(value ?? categoryId)}
                disabled={!canManage}
              >
                <SelectTrigger id="gift-detail-category">
                  <SelectValue>
                    {(value: string) =>
                      categories.find((category) => category.id === value)?.name ?? gift.category.name
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
            </div>

            <FormField htmlFor="gift-detail-description" label="Description (optional)">
              <Textarea
                id="gift-detail-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={!canManage}
                className="min-h-20 resize-none"
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField htmlFor="gift-detail-points" label="Points Cost">
                <Input
                  id="gift-detail-points"
                  type="number"
                  min="0"
                  value={pointsCost}
                  onChange={(event) => setPointsCost(event.target.value)}
                  disabled={!canManage}
                  required
                />
              </FormField>

              <FormField htmlFor="gift-detail-retail-value" label="Retail Value (৳)">
                <Input
                  id="gift-detail-retail-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={retailValue}
                  onChange={(event) => setRetailValue(event.target.value)}
                  disabled={!canManage}
                  required
                />
              </FormField>

              <FormField htmlFor="gift-detail-stock" label="Stock Quantity">
                <Input
                  id="gift-detail-stock"
                  type="number"
                  min="0"
                  value={stockQuantity}
                  onChange={(event) => setStockQuantity(event.target.value)}
                  disabled={!canManage}
                  required
                />
              </FormField>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          {canManage && (
            <CardFooter className="justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={handleDelete}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                {deleting ? "Deleting…" : "Delete Gift"}
              </Button>
              <Button
                type="submit"
                disabled={submitting || !name || !categoryId || !pointsCost || !retailValue}
              >
                {submitting ? "Saving…" : "Save changes"}
              </Button>
            </CardFooter>
          )}
        </Card>
      </form>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Stock status</span>
              <StockStatusBadge status={gift.stockStatus} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Retail value</span>
              <span className="font-medium">{formatCurrency(gift.retailValue)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Times redeemed</span>
              <span className="flex items-center gap-1 font-medium">
                <Repeat2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {gift.timesRedeemed}×
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders for this gift</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
                <Clock className="size-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  No orders have been placed for this gift yet.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{order.customerName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {relativeTimeFrom(order.createdAt)}
                      </p>
                    </div>
                    <GiftStatusBadge status={order.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
