"use client";

import { Globe } from "lucide-react";
import { useState } from "react";

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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateForm } from "@/lib/api/forms";
import { getErrorMessage } from "@/lib/api/types";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Publishes this form directly as an open, tokenless public form at the
 * site root — mysite.com/{slug}, no /form/ prefix — no campaign, no
 * per-customer token; anyone can open the link and fill it in. A
 * submission finds or creates a Customer by phone number (see
 * app.services.forms.submit_generic_form on the backend). This is a
 * separate path from "Send via Campaign", which instead makes the form
 * part of one specific campaign's tokenized landing page. */
export function PublishOpenFormDialog({
  formId,
  formName,
  initialSlug,
  initialPublished,
  onSaved,
}: {
  formId: string;
  formName: string;
  initialSlug: string | null;
  initialPublished: boolean;
  onSaved: (result: { slug: string | null; published: boolean }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(initialSlug ?? slugify(formName));
  const [published, setPublished] = useState(initialPublished);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSlug(initialSlug ?? slugify(formName));
      setPublished(initialPublished);
      setError(null);
      setSavedMessage(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const updated = await updateForm(formId, { slug, published });
      setSavedMessage("Saved.");
      onSaved({ slug: updated.slug, published: updated.published });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to publish this form. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  const publicUrl = typeof window !== "undefined" && slug ? `${window.location.origin}/${slug}` : "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline">
            <Globe className="size-4" />
            Publish as Open Form
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish as Open Form</DialogTitle>
          <DialogDescription>
            Anyone with this link can open it and fill it in — no token, no existing customer
            needed. A submission finds or creates a customer by phone number.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="open-form-slug">Slug (in the public URL)</Label>
          <Input
            id="open-form-slug"
            value={slug}
            onChange={(event) => setSlug(slugify(event.target.value))}
          />
        </div>

        {publicUrl && (
          <p className="text-xs break-all text-muted-foreground">
            Public link: <span className="font-mono">{publicUrl}</span>
          </p>
        )}

        <div className="flex items-center gap-2">
          <Switch id="open-form-published" checked={published} onCheckedChange={setPublished} />
          <Label htmlFor="open-form-published">Published</Label>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter showCloseButton>
          {savedMessage && (
            <p className="mr-auto self-center text-xs text-muted-foreground">{savedMessage}</p>
          )}
          <Button type="button" onClick={handleSave} disabled={saving || !slug}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
