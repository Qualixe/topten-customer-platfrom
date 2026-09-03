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
import type { MessageTemplate } from "@/lib/api/templates";

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Card-grid alternative to TemplatesTable — same data and interactions
 * (click a card to edit, "⋯" menu for Edit/Delete), just laid out as a
 * gallery of message previews instead of table rows. Same props shape as
 * TemplatesTable on purpose, so the parent can swap between them freely. */
export function TemplatesGrid({
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
  if (!loading && templates.length === 0) {
    return (
      <div className="rounded-lg border">
        <EmptyState
          icon={MessageSquareText}
          title="No templates found"
          description="Create a template to reuse across campaigns."
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {templates.map((template) => (
        <div
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
          className={
            "flex flex-col gap-2 rounded-lg border bg-card p-4 transition-shadow" +
            (canManage ? " cursor-pointer hover:shadow-md" : "")
          }
        >
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-1 text-sm font-medium">{template.name}</p>
            <TemplateChannelBadge channel={template.channel} />
          </div>

          {template.subject && (
            <p className="line-clamp-1 text-xs text-muted-foreground">{template.subject}</p>
          )}

          <p className="line-clamp-3 min-h-[3.75rem] text-xs whitespace-pre-wrap text-muted-foreground">
            {template.body || "No content added."}
          </p>

          <div className="mt-auto flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Updated {formatUpdatedAt(template.updatedAt)}
            </p>
            {canManage && (
              <div onClick={(event) => event.stopPropagation()}>
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
                    <DropdownMenuItem variant="destructive" onClick={() => onDeleteRequest(template)}>
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
