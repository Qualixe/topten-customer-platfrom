"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { DeleteFormDialog } from "@/components/dashboard/forms/delete-form-dialog";
import { FormsPagination } from "@/components/dashboard/forms/forms-pagination";
import { FormsTable } from "@/components/dashboard/forms/forms-table";
import { PreviewFormDialog } from "@/components/dashboard/forms/preview-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteForm, duplicateForm, listForms, type FormRecord } from "@/lib/api/forms";
import { getErrorMessage } from "@/lib/api/types";

const PAGE_SIZE = 20;

export function FormsPageClient({
  initialForms,
  initialMeta,
  canManage,
}: {
  initialForms: FormRecord[];
  initialMeta: { total: number; page: number; pageSize: number };
  canManage: boolean;
}) {
  const [forms, setForms] = useState<FormRecord[]>(initialForms);
  const [meta, setMeta] = useState(initialMeta);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FormRecord | null>(null);
  const [previewTarget, setPreviewTarget] = useState<FormRecord | null>(null);

  const isFirstRender = useRef(true);

  async function refresh(nextPage: number, nextSearch: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await listForms({ page: nextPage, pageSize: PAGE_SIZE, search: nextSearch });
      setForms(result.items);
      setMeta({ total: result.total, page: result.page, pageSize: result.pageSize });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load forms. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  // Skip the fetch on mount — the server component already fetched page 1
  // with no search filter, so re-running the same query would be wasted.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => refresh(page, search), search === "" ? 0 : 300);
    return () => clearTimeout(timeout);
  }, [page, search]);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  async function handleDuplicate(form: FormRecord) {
    setError(null);
    try {
      await duplicateForm(form.id);
      await refresh(page, search);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to duplicate this form. Please try again."));
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    await deleteForm(deleteTarget.id);
    setDeleteTarget(null);
    await refresh(page, search);
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Forms</h2>
          <p className="text-sm text-muted-foreground">
            Build custom forms for customer verification campaigns.
          </p>
        </div>
        {canManage && (
          <Button nativeButton={false} render={<Link href="/dashboard/forms/new" />}>
            <Plus className="size-4" />
            Create Form
          </Button>
        )}
      </div>

      <div className="relative sm:max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={search}
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder="Search forms…"
          className="pl-8"
          aria-label="Search forms"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <FormsTable
        forms={forms}
        loading={loading}
        canManage={canManage}
        onDuplicate={handleDuplicate}
        onDeleteRequest={setDeleteTarget}
        onPreviewRequest={setPreviewTarget}
      />

      <FormsPagination
        page={meta.page}
        totalPages={totalPages}
        totalItems={meta.total}
        pageSize={meta.pageSize}
        onPageChange={setPage}
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
