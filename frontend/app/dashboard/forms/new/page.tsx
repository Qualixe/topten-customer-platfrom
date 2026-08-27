"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createForm } from "@/lib/form-builder/storage";

export default function NewFormPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const form = createForm(name.trim(), description.trim());
    router.push(`/dashboard/forms/${form.id}/builder`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={<Link href="/dashboard/forms" aria-label="Back to forms" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Create Form</h2>
          <p className="text-sm text-muted-foreground">Give your form a name to start building it.</p>
        </div>
      </div>

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

        <Button type="submit" disabled={!name.trim()}>
          Create Form
        </Button>
      </form>
    </div>
  );
}
