"use client";

import { Settings2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FIELD_DEFINITIONS } from "@/lib/form-builder/field-config";
import type { FormField } from "@/lib/form-builder/types";

const TEXT_ONLY_TYPES: FormField["type"][] = ["heading", "paragraph", "submit_button"];
const PLACEHOLDER_TYPES: FormField["type"][] = ["name", "email", "phone", "address", "city"];
const REQUIRED_TYPES: FormField["type"][] = [
  "name",
  "email",
  "phone",
  "date_of_birth",
  "address",
  "city",
  "marketing_consent",
];

/** Right column — editable properties for whichever field is selected.
 * Only the properties relevant to that field's type are shown. */
export function FormProperties({
  field,
  onChange,
  onDelete,
  note,
  onNoteChange,
  noteDisabled,
}: {
  field: FormField | null;
  onChange: (id: string, patch: Partial<FormField>) => void;
  onDelete: (id: string) => void;
  /** Internal-only note about the form itself (Form.description on the
   * backend) — never shown to customers or on the public form, just a
   * staff scratchpad while building/maintaining it. */
  note: string;
  onNoteChange: (value: string) => void;
  noteDisabled?: boolean;
}) {
  if (!field) {
    return (
      <div className="flex h-full min-h-64 flex-col gap-4 rounded-lg border bg-background p-4">
        <EmptyState
          icon={Settings2}
          title="No field selected"
          description="Select a field on the canvas to edit its properties."
        />
        <Separator />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="form-note">Internal note</Label>
          <Textarea
            id="form-note"
            className="min-h-24 resize-none"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Staff-only notes about this form — never shown to customers or on the public page."
            disabled={noteDisabled}
          />
        </div>
      </div>
    );
  }

  function set(patch: Partial<FormField>) {
    onChange(field!.id, patch);
  }

  const labelCaption =
    field.type === "heading" ? "Heading text" : field.type === "paragraph" ? "Paragraph text" : "Button text";

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-background p-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Editing</p>
        <p className="text-sm font-semibold">{FIELD_DEFINITIONS[field.type].label}</p>
      </div>

      <Separator />

      {field.type === "divider" ? (
        <p className="text-sm text-muted-foreground">This field has no editable properties.</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prop-label">{TEXT_ONLY_TYPES.includes(field.type) ? labelCaption : "Label"}</Label>
            <Input id="prop-label" value={field.label} onChange={(event) => set({ label: event.target.value })} />
          </div>

          {PLACEHOLDER_TYPES.includes(field.type) && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prop-placeholder">Placeholder</Label>
              <Input
                id="prop-placeholder"
                value={field.placeholder ?? ""}
                onChange={(event) => set({ placeholder: event.target.value })}
              />
            </div>
          )}

          {(field.type === "heading" || field.type === "paragraph") && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prop-align">Alignment</Label>
              <Select
                value={field.align ?? "left"}
                onValueChange={(value) => set({ align: value as FormField["align"] })}
              >
                <SelectTrigger id="prop-align">
                  <SelectValue>{(value: string) => value.charAt(0).toUpperCase() + value.slice(1)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {field.type === "heading" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prop-size">Size</Label>
              <Select value={field.size ?? "md"} onValueChange={(value) => set({ size: value as FormField["size"] })}>
                <SelectTrigger id="prop-size">
                  <SelectValue>{(value: string) => value.toUpperCase()}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Small</SelectItem>
                  <SelectItem value="md">Medium</SelectItem>
                  <SelectItem value="lg">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {REQUIRED_TYPES.includes(field.type) && (
            <div className="flex items-center gap-2">
              <Switch
                id="prop-required"
                checked={field.required ?? false}
                onCheckedChange={(checked) => set({ required: checked })}
              />
              <Label htmlFor="prop-required">Required</Label>
            </div>
          )}
        </>
      )}

      <Separator />

      <Button type="button" variant="destructive" onClick={() => onDelete(field.id)}>
        <Trash2 className="size-4" />
        Delete field
      </Button>
    </div>
  );
}
