"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DeleteFormDialog } from "@/components/dashboard/forms/delete-form-dialog";
import { FormsTable } from "@/components/dashboard/forms/forms-table";
import { PreviewFormDialog } from "@/components/dashboard/forms/preview-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteForm, duplicateForm, getForms } from "@/lib/form-builder/storage";
import type { FormRecord } from "@/lib/form-builder/types";

export default function FormsPage() {
  // null = not loaded yet (avoids a flash of "No forms found" before the
  // localStorage read happens in the effect below).
  const [forms, setForms] = useState<FormRecord[] | null>(null);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FormRecord | null>(null);
  const [previewTarget, setPreviewTarget] = useState<FormRecord | null>(null);

  useEffect(() => {
    setForms(getForms());
  }, []);

  function refresh() {
    setForms(getForms());
  }

  function handleDuplicate(form: FormRecord) {
    duplicateForm(form.id);
    refresh();
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteForm(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
  }

  const visibleForms = (forms ?? []).filter((form) =>
    form.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Forms</h2>
          <p className="text-sm text-muted-foreground">
            Build custom forms for customer verification campaigns.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/forms/new" />}>
          <Plus className="size-4" />
          Create Form
        </Button>
      </div>

      <div className="relative sm:max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search forms…"
          className="pl-8"
          aria-label="Search forms"
        />
      </div>

      <FormsTable
        forms={visibleForms}
        loading={forms === null}
        onDuplicate={handleDuplicate}
        onDeleteRequest={setDeleteTarget}
        onPreviewRequest={setPreviewTarget}
      />

      <DeleteFormDialog
        form={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      <PreviewFormDialog
        form={previewTarget}
        open={previewTarget !== null}
        onOpenChange={(open) => !open && setPreviewTarget(null)}
      />
    </div>
  );
}
