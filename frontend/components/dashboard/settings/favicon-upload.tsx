"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ImageIcon, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  getSiteLogo,
  removeSiteFavicon,
  resolveLogoUrl,
  uploadSiteFavicon,
} from "@/lib/api/site-settings";
import { getErrorMessage } from "@/lib/api/types";

const ALLOWED_TYPES = ["image/png", "image/x-icon", "image/vnd.microsoft.icon"];
const MAX_SIZE_BYTES = 512 * 1024;

export function FaviconUpload() {
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    getSiteLogo()
      .then((logo) => {
        if (!cancelled) setFaviconUrl(logo.faviconUrl);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(err, "Unable to load the current favicon."));
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
      setError("Favicon must be a PNG or ICO image.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Favicon must be smaller than 512 KB.");
      return;
    }

    setBusy(true);
    try {
      const result = await uploadSiteFavicon(file);
      setFaviconUrl(result.faviconUrl);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to upload the favicon. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      await removeSiteFavicon();
      setFaviconUrl(null);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to remove the favicon. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const resolvedUrl = resolveLogoUrl(faviconUrl);

  return (
    <div className="flex flex-col gap-2">
      <Label>Favicon</Label>
      <div className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {loading ? null : resolvedUrl ? (
            <Image
              src={resolvedUrl}
              alt="Favicon"
              width={32}
              height={32}
              className="size-8 object-contain"
              unoptimized
            />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          )}
        </span>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/x-icon,.ico"
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
              {busy ? "Uploading…" : faviconUrl ? "Change Favicon" : "Upload Favicon"}
            </Button>
            {faviconUrl && (
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
            PNG or ICO, up to 512 KB. Shown as the browser tab icon everywhere.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}
