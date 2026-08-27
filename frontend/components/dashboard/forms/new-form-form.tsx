"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createForm } from "@/lib/api/forms";
import { getErrorMessage } from "@/lib/api/types";

export function NewFormForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const form = await createForm(name.trim(), description.trim());
      router.push(`/dashboard/forms/${form.id}/builder`);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create this form. Please try again."));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4 rounded-lg border bg-background p-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="form-name">Form Name</Label>
        <Input
          id="form-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Customer Information"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="form-description">Description</Label>
        <Textarea
          id="form-description"
          className="min-h-24 resize-none"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What is this form used for?"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={!name.trim() || submitting}>
        {submitting ? "Creating…" : "Create Form"}
      </Button>
    </form>
  );
}
