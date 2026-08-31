"use client";

import { MessageSquareText, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { TemplateChannelBadge } from "@/components/dashboard/templates/template-channel-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MessageTemplate } from "@/lib/api/templates";

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function TemplatesTable({
  templates,
  loading,
  canManage,
  onEditRequest,
  onDeleteRequest,
}: {
  templates: MessageTemplate[];
  loading: boolean;
  canManage: boolean;
  onEditRequest: (template: MessageTemplate) => void;
  onDeleteRequest: (template: MessageTemplate) => void;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!loading && templates.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="p-0">
                <EmptyState
                  icon={MessageSquareText}
                  title="No templates found"
                  description="Create a template to reuse across campaigns."
                />
              </TableCell>
            </TableRow>
          )}
          {templates.map((template) => (
            <TableRow
              key={template.id}
              role={canManage ? "button" : undefined}
              tabIndex={canManage ? 0 : undefined}
              onClick={canManage ? () => onEditRequest(template) : undefined}
              onKeyDown={(event) => {
                if (!canManage) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onEditRequest(template);
                }
              }}
              className={canManage ? "cursor-pointer" : undefined}
            >
              <TableCell>
                <p className="text-sm font-medium">{template.name}</p>
                {template.subject && (
                  <p className="max-w-xs truncate text-xs text-muted-foreground">
                    {template.subject}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <TemplateChannelBadge channel={template.channel} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatUpdatedAt(template.updatedAt)}
              </TableCell>
              <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${template.name}`}
                        />
                      }
                    >
                      <MoreVertical className="size-4" aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditRequest(template)}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onDeleteRequest(template)}
                      >
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
