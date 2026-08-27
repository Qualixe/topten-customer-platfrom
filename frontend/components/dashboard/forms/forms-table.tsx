import { Eye, FileText, MoreVertical, Pencil, Repeat2, Trash2 } from "lucide-react";
import Link from "next/link";

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
import type { FormRecord } from "@/lib/form-builder/types";

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

export function FormsTable({
  forms,
  loading,
  onDuplicate,
  onDeleteRequest,
  onPreviewRequest,
}: {
  forms: FormRecord[];
  loading: boolean;
  onDuplicate: (form: FormRecord) => void;
  onDeleteRequest: (form: FormRecord) => void;
  onPreviewRequest: (form: FormRecord) => void;
}) {
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
            <TableRow key={form.id}>
              <TableCell>
                <p className="text-sm font-medium">{form.name}</p>
                <p className="max-w-xs truncate text-xs text-muted-foreground">{form.description}</p>
              </TableCell>
              <TableCell>
                <FormStatusBadge status={form.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatUpdatedAt(form.updatedAt)}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${form.name}`} />}
                  >
                    <MoreVertical className="size-4" aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem render={<Link href={`/dashboard/forms/${form.id}/builder`} />}>
                      <Pencil /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPreviewRequest(form)}>
                      <Eye /> Preview
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(form)}>
                      <Repeat2 /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => onDeleteRequest(form)}>
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
