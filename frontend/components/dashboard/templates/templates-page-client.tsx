"use client";

import { Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DeleteTemplateDialog } from "@/components/dashboard/templates/delete-template-dialog";
import { TemplateFormDialog } from "@/components/dashboard/templates/template-form-dialog";
import { TemplatesGrid } from "@/components/dashboard/templates/templates-grid";
import { TemplatesPagination } from "@/components/dashboard/templates/templates-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteTemplate,
  listTemplates,
  type MessageTemplate,
  type TemplateChannel,
} from "@/lib/api/templates";
import { getErrorMessage } from "@/lib/api/types";

const PAGE_SIZE = 20;
type ChannelFilter = TemplateChannel | "all";
const CHANNEL_FILTER_LABELS: Record<ChannelFilter, string> = {
  all: "All Channels",
  SMS: "SMS",
  EMAIL: "Email",
};

export function TemplatesPageClient({
  initialTemplates,
  initialMeta,
  canManage,
}: {
  initialTemplates: MessageTemplate[];
  initialMeta: { total: number; page: number; pageSize: number };
  canManage: boolean;
}) {
  const [templates, setTemplates] = useState<MessageTemplate[]>(initialTemplates);
  const [meta, setMeta] = useState(initialMeta);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<MessageTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MessageTemplate | null>(null);

  const isFirstRender = useRef(true);
  // Bumped on every refresh; a response only gets applied if it's still the
  // most recent request — otherwise a slow earlier response (e.g. from a
  // fast-typed search) could overwrite a newer one that already landed.
  const requestId = useRef(0);

  async function refresh(nextPage: number, nextSearch: string, nextChannel: ChannelFilter) {
    const thisRequestId = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listTemplates({
        page: nextPage,
        pageSize: PAGE_SIZE,
        search: nextSearch,
        channel: nextChannel === "all" ? undefined : nextChannel,
      });
      if (thisRequestId !== requestId.current) return;
      setTemplates(result.items);
      setMeta({ total: result.total, page: result.page, pageSize: result.pageSize });
    } catch (err) {
      if (thisRequestId !== requestId.current) return;
      setError(getErrorMessage(err, "Unable to load templates. Please try again."));
    } finally {
      if (thisRequestId === requestId.current) setLoading(false);
    }
  }

  // Skip the fetch on mount — the server component already fetched page 1
  // with no filters, so re-running the same query would be wasted.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(
      () => refresh(page, search, channelFilter),
      search === "" ? 0 : 300
    );
    return () => clearTimeout(timeout);
  }, [page, search, channelFilter]);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleChannelFilterChange(value: ChannelFilter) {
    setChannelFilter(value);
    setPage(1);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    await deleteTemplate(deleteTarget.id);
    setDeleteTarget(null);

    // Deleting the last item on a page beyond page 1 would otherwise leave
    // the view stranded on a now-empty page. Changing `page` here already
    // triggers the fetch via the effect above, so only refresh directly
    // when the page isn't changing (the effect wouldn't fire for that).
    if (templates.length === 1 && page > 1) {
      setPage(page - 1);
    } else {
      await refresh(page, search, channelFilter);
    }
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Templates</h2>
          <p className="text-sm text-muted-foreground">
            Reusable SMS and Email message templates for campaigns.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New Template
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search templates…"
            className="pl-8"
            aria-label="Search templates"
          />
        </div>
        <Select
          value={channelFilter}
          onValueChange={(value) => handleChannelFilterChange(value as ChannelFilter)}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by channel">
            <SelectValue>{(value: ChannelFilter) => CHANNEL_FILTER_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="SMS">SMS</SelectItem>
            <SelectItem value="EMAIL">Email</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <TemplatesGrid
        templates={templates}
        loading={loading}
        canManage={canManage}
        onEditRequest={setFormTarget}
        onDeleteRequest={setDeleteTarget}
      />

      <TemplatesPagination
        page={meta.page}
        totalPages={totalPages}
        totalItems={meta.total}
        pageSize={meta.pageSize}
        onPageChange={setPage}
      />

      <TemplateFormDialog
        template={formTarget}
        open={creating || formTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setFormTarget(null);
          }
        }}
        onSaved={() => {
          setCreating(false);
          setFormTarget(null);
          refresh(page, search, channelFilter);
        }}
      />

      <DeleteTemplateDialog
        template={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
