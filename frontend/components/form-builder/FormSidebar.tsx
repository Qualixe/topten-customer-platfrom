"use client";

import { FIELD_DEFINITIONS } from "@/lib/form-builder/field-config";
import { NEW_FIELD_DRAG_TYPE, type FieldType } from "@/lib/form-builder/types";
import { Button } from "@/components/ui/button";

/** Left column — click a field to add it to the end of the canvas, or drag
 * it into the canvas to drop it at a specific spot. */
export function FormSidebar({ onAddField }: { onAddField: (type: FieldType) => void }) {
  const entries = Object.entries(FIELD_DEFINITIONS) as [FieldType, (typeof FIELD_DEFINITIONS)[FieldType]][];

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
      <p className="px-1 text-xs font-medium text-muted-foreground">Fields</p>
      {entries.map(([type, definition]) => {
        const Icon = definition.icon;
        return (
          <Button
            key={type}
            type="button"
            variant="outline"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(NEW_FIELD_DRAG_TYPE, type);
              event.dataTransfer.effectAllowed = "copy";
            }}
            className="cursor-grab justify-start active:cursor-grabbing"
            onClick={() => onAddField(type)}
          >
            <Icon className="size-4" aria-hidden="true" />
            {definition.label}
          </Button>
        );
      })}
    </div>
  );
}
