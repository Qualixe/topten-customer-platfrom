"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";
import { Gift as GiftIcon, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

/** File picker + preview tile for a gift's photo. Does its own client-side
 * type/size validation before handing a valid file up to the caller, which
 * owns whatever happens next (deferred upload on create, immediate upload
 * on edit) — this component has no opinion on when the upload actually
 * happens. */
export function GiftImageField({
  previewUrl,
  onSelectFile,
  onRemove,
  busy = false,
}: {
  previewUrl: string | null;
  onSelectFile: (file: File) => void;
  onRemove?: () => void;
  busy?: boolean;
}) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setValidationError("Photo must be a PNG, JPEG, or WEBP image.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setValidationError("Photo must be smaller than 2 MB.");
      return;
    }

    setValidationError(null);
    onSelectFile(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Photo (optional)</Label>
      <div className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {previewUrl ? (
            <Image
              src={previewUrl}
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

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileSelected}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5" aria-hidden="true" />
              {busy ? "Uploading…" : previewUrl ? "Change Photo" : "Upload Photo"}
            </Button>
            {previewUrl && onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={onRemove}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPEG, or WEBP, up to 2 MB.</p>
          {validationError && <p className="text-xs text-destructive">{validationError}</p>}
        </div>
      </div>
    </div>
  );
}
