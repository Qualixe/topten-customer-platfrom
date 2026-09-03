"use client";

import { Check, Copy, Eye, FileText, MoreVertical, Pencil, Repeat2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormStatusBadge } from "@/components/dashboard/forms/form-status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FormRecord } from "@/lib/api/forms";

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CopyUrlButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(event: React.MouseEvent) {
    event.stopPropagation();
    const url = `${window.location.origin}/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      aria-label="Copy public URL"
      className="gap-1.5"
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-500" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      {copied ? "Copied" : "Copy URL"}
    </Button>
  );
}

export function FormsTable({
  forms,
  loading,
  canManage,
  onDuplicate,
  onDeleteRequest,
  onPreviewRequest,
}: {
  forms: FormRecord[];
  loading: boolean;
  canManage: boolean;
  onDuplicate: (form: FormRecord) => void;
  onDeleteRequest: (form: FormRecord) => void;
  onPreviewRequest: (form: FormRecord) => void;
}) {
  const router = useRouter();

  function goToBuilder(form: FormRecord) {
    router.push(`/dashboard/forms/${form.id}/builder`);
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!loading && forms.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="p-0">
                <EmptyState icon={FileText} title="No forms found" description="Create a form to get started." />
              </TableCell>
            </TableRow>
          )}
          {forms.map((form) => (
            <TableRow
              key={form.id}
              role="button"
              tabIndex={0}
              onClick={() => goToBuilder(form)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  goToBuilder(form);
                }
              }}
              className="cursor-pointer"
            >
              <TableCell>
                <p className="text-sm font-medium">{form.name}</p>
                <p className="max-w-xs truncate text-xs text-muted-foreground">{form.description}</p>
              </TableCell>
              <TableCell>
                <FormStatusBadge status={form.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatUpdatedAt(form.updatedAt)}</TableCell>
              <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-end gap-2">
                  {/* Copy public URL — only when the form has a published slug */}
                  {form.slug && form.published && (
                    <CopyUrlButton slug={form.slug} />
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${form.name}`} />}
                    >
                      <MoreVertical className="size-4" aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem render={<Link href={`/dashboard/forms/${form.id}/builder`} />}>
                        <Pencil /> {canManage ? "Edit" : "View"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onPreviewRequest(form)}>
                        <Eye /> Preview
                      </DropdownMenuItem>
                      {canManage && (
                        <>
                          <DropdownMenuItem onClick={() => onDuplicate(form)}>
                            <Repeat2 /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => onDeleteRequest(form)}>
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

