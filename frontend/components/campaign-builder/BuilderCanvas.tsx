"use client";

import { useState } from "react";
import { GripVertical, LayoutTemplate, Trash2 } from "lucide-react";

import { BlockRenderer } from "@/components/campaign-builder/blocks";
import type { Block } from "@/components/campaign-builder/types";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/** Center column — the list of blocks. Each block is draggable (native
 * HTML5 drag-and-drop, no extra library needed) to reorder, clickable to
 * select, and has a delete button that appears on hover. */
export function BuilderCanvas({
  blocks,
  selectedId,
  onSelect,
  onDelete,
  onReorder,
}: {
  blocks: Block[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (fromId: string, toId: string) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  if (blocks.length === 0) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center rounded-lg border border-dashed bg-background">
        <EmptyState
          icon={LayoutTemplate}
          title="Your canvas is empty"
          description="Click a component on the left to add it to your landing page."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-4">
      {blocks.map((block) => (
        <div
          key={block.id}
          draggable
          onDragStart={(event) => {
            setDraggedId(block.id);
            // Firefox requires data to be set for the drag to start at all.
            event.dataTransfer.setData("text/plain", block.id);
            event.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (draggedId && draggedId !== block.id) onReorder(draggedId, block.id);
            setDraggedId(null);
          }}
          onDragEnd={() => setDraggedId(null)}
          onClick={() => onSelect(block.id)}
          className={cn(
            "group relative cursor-pointer rounded-md border-2 p-3 transition-colors",
            selectedId === block.id
              ? "border-primary"
              : "border-transparent hover:border-muted-foreground/30",
            draggedId === block.id && "opacity-40"
          )}
        >
          <div className="absolute top-1 left-1 hidden items-center rounded-md bg-background p-1 text-muted-foreground shadow-sm group-hover:flex">
            <GripVertical className="size-3.5" aria-hidden="true" />
          </div>

          <button
            type="button"
            aria-label="Delete block"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(block.id);
            }}
            className="absolute top-1 right-1 hidden size-6 items-center justify-center rounded-md bg-background text-muted-foreground shadow-sm hover:text-destructive group-hover:flex"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>

          <div className="px-5">
            <BlockRenderer block={block} />
          </div>
        </div>
      ))}
    </div>
  );
}
