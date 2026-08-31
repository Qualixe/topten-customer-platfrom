"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Store, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  getSiteLogo,
  removeSiteLogo,
  resolveLogoUrl,
  uploadSiteLogo,
} from "@/lib/api/site-settings";
import { getErrorMessage } from "@/lib/api/types";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export function SiteLogoUpload() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    getSiteLogo()
      .then((logo) => {
        if (!cancelled) setLogoUrl(logo.logoUrl);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(err, "Unable to load the current logo."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Logo must be a PNG, JPEG, or WEBP image.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Logo must be smaller than 2 MB.");
      return;
    }

    setBusy(true);
    try {
      const result = await uploadSiteLogo(file);
      setLogoUrl(result.logoUrl);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to upload the logo. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      await removeSiteLogo();
      setLogoUrl(null);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to remove the logo. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const resolvedUrl = resolveLogoUrl(logoUrl);

  return (
    <div className="flex flex-col gap-2">
      <Label>Site Logo</Label>
      <div className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {loading ? null : resolvedUrl ? (
            <Image
              src={resolvedUrl}
              alt="Site logo"
              width={64}
              height={64}
              className="size-full object-contain"
            />
          ) : (
            <Store className="size-6 text-muted-foreground" aria-hidden="true" />
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
              disabled={loading || busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5" aria-hidden="true" />
              {busy ? "Uploading…" : logoUrl ? "Change Logo" : "Upload Logo"}
            </Button>
            {logoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={handleRemove}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPEG, or WEBP, up to 2 MB. Shown in the admin sidebar and on
            customer-facing pages.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}
