"use client";

import { useState } from "react";
import { Copy, GripVertical, LayoutTemplate, Trash2 } from "lucide-react";

import { FieldRenderer } from "@/components/form-builder/fields";
import { EmptyState } from "@/components/ui/empty-state";
import { EXISTING_FIELD_DRAG_TYPE, NEW_FIELD_DRAG_TYPE, type FieldType, type FormField } from "@/lib/form-builder/types";
import { cn } from "@/lib/utils";

/** Center column — the list of fields. Uses native HTML5 drag-and-drop (no
 * extra library needed): a field is draggable to reorder it, and dropping
 * either a new field from the sidebar or an existing field onto another
 * field inserts it right before that field — which is how "drop between
 * existing fields" is achieved without any position/index math in the
 * parent. Dropping on the container itself (below the last field, or on
 * the empty state) appends to the end. */
export function FormCanvas({
  fields,
  selectedId,
  onSelect,
  onDelete,
  onDuplicate,
  onInsertNewFieldBefore,
  onReorder,
  onAppendNewField,
  readOnly = false,
}: {
  fields: FormField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onInsertNewFieldBefore: (type: FieldType, beforeId: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onAppendNewField: (type: FieldType) => void;
  /** No dragging, no delete/duplicate controls, no selection — for a
   * viewer without forms.manage. The parent doesn't need to worry about
   * passing safe no-op handlers; this is enforced here. */
  readOnly?: boolean;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  function handleDropOnField(event: React.DragEvent, beforeId: string) {
    event.preventDefault();
    const newType = event.dataTransfer.getData(NEW_FIELD_DRAG_TYPE);
    if (newType) {
      onInsertNewFieldBefore(newType as FieldType, beforeId);
    } else if (draggedId && draggedId !== beforeId) {
      onReorder(draggedId, beforeId);
    }
    setDraggedId(null);
  }

  function handleDropOnContainer(event: React.DragEvent) {
    event.preventDefault();
    const newType = event.dataTransfer.getData(NEW_FIELD_DRAG_TYPE);
    if (newType) onAppendNewField(newType as FieldType);
    setDraggedId(null);
  }

  if (fields.length === 0) {
    return (
      <div
        onDragOver={readOnly ? undefined : (event) => event.preventDefault()}
        onDrop={readOnly ? undefined : handleDropOnContainer}
        className="flex h-full min-h-64 items-center justify-center rounded-lg border border-dashed bg-background"
      >
        <EmptyState
          icon={LayoutTemplate}
          title="Your canvas is empty"
          description={readOnly ? "This form has no fields yet." : "Drag a field here to start building your form."}
        />
      </div>
    );
  }

  return (
    <div
      onDragOver={readOnly ? undefined : (event) => event.preventDefault()}
      onDrop={readOnly ? undefined : handleDropOnContainer}
      className="flex flex-col gap-3 rounded-lg border bg-background p-4"
    >
      {fields.map((field) => (
        <div
          key={field.id}
          draggable={!readOnly}
          onDragStart={
            readOnly
              ? undefined
              : (event) => {
                  setDraggedId(field.id);
                  event.dataTransfer.setData(EXISTING_FIELD_DRAG_TYPE, field.id);
                  event.dataTransfer.effectAllowed = "move";
                }
          }
          onDragOver={readOnly ? undefined : (event) => event.preventDefault()}
          onDrop={readOnly ? undefined : (event) => handleDropOnField(event, field.id)}
          onDragEnd={readOnly ? undefined : () => setDraggedId(null)}
          onClick={readOnly ? undefined : () => onSelect(field.id)}
          className={cn(
            "group relative rounded-md border-2 p-3 transition-colors",
            readOnly ? "cursor-default" : "cursor-pointer",
            selectedId === field.id
              ? "border-primary"
              : "border-transparent hover:border-muted-foreground/30",
            draggedId === field.id && "opacity-40"
          )}
        >
          {!readOnly && (
            <>
              <div className="absolute top-1 left-1 hidden items-center rounded-md bg-background p-1 text-muted-foreground shadow-sm group-hover:flex">
                <GripVertical className="size-3.5" aria-hidden="true" />
              </div>

              <div className="absolute top-1 right-1 hidden items-center gap-1 group-hover:flex">
                <button
                  type="button"
                  aria-label="Duplicate field"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDuplicate(field.id);
                  }}
                  className="flex size-6 items-center justify-center rounded-md bg-background text-muted-foreground shadow-sm hover:text-foreground"
                >
                  <Copy className="size-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Delete field"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(field.id);
                  }}
                  className="flex size-6 items-center justify-center rounded-md bg-background text-muted-foreground shadow-sm hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </>
          )}

          <div className="px-5">
            <FieldRenderer field={field} />
          </div>
        </div>
      ))}
    </div>
  );
}
