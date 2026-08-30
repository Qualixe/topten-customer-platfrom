"use client";

import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_BRAND_COLOR,
  getSiteLogo,
  updateBrandColor,
} from "@/lib/api/site-settings";
import { getErrorMessage } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/** A handful of vivid, modern-dashboard-friendly presets — red first since
 * it matches the current default, the rest span enough hue to suit most
 * brands without overwhelming choice. */
const PRESETS = [
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#10B981",
  "#0EA5E9",
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
];

export function BrandColorPicker() {
  const [savedColor, setSavedColor] = useState(DEFAULT_BRAND_COLOR);
  const [color, setColor] = useState(DEFAULT_BRAND_COLOR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getSiteLogo()
      .then((data) => {
        if (cancelled) return;
        setSavedColor(data.brandColor);
        setColor(data.brandColor);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, "Unable to load the current brand color."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isValid = HEX_PATTERN.test(color);
  const isDirty = color.toUpperCase() !== savedColor.toUpperCase();

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateBrandColor(color);
      setSavedColor(result.brandColor);
      setColor(result.brandColor);
      setSaved(true);
      // Applied app-wide via a CSS variable set in the root layout — that
      // only re-fetches on navigation, so a full reload is the simplest way
      // to see it reflected everywhere (sidebar, buttons) right away.
      window.location.reload();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to save the brand color. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="brand-color-hex">Brand Color</Label>
      <div className="flex items-center gap-4">
        <span
          className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border"
          style={{ backgroundColor: isValid ? color : undefined }}
        >
          {!isValid && <Palette className="size-6 text-muted-foreground" aria-hidden="true" />}
        </span>

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Pick a brand color"
              value={isValid ? color : DEFAULT_BRAND_COLOR}
              onChange={(event) => setColor(event.target.value.toUpperCase())}
              disabled={loading}
              className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
            />
            <Input
              id="brand-color-hex"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              placeholder="#EF4444"
              disabled={loading}
              className="w-32 font-mono uppercase"
              maxLength={7}
            />
            <Button type="button" size="sm" disabled={loading || saving || !isValid || !isDirty} onClick={handleSave}>
              {saving ? "Saving…" : saved && !isDirty ? (
                <>
                  <Check className="size-3.5" aria-hidden="true" />
                  Saved
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-label={`Use ${preset}`}
                onClick={() => setColor(preset)}
                className={cn(
                  "size-6 rounded-full border-2 transition-transform hover:scale-110",
                  color.toUpperCase() === preset ? "border-foreground" : "border-transparent"
                )}
                style={{ backgroundColor: preset }}
              />
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Used for buttons, focus rings, and the active sidebar item across the whole admin
            dashboard.
          </p>
          {!isValid && (
            <p className="text-xs text-destructive">Enter a valid hex color, e.g. #EF4444.</p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}
