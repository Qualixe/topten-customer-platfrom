import { Settings2, Trash2 } from "lucide-react";

import { BLOCK_DEFINITIONS, type Block } from "@/components/campaign-builder/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

/** Right column — editable fields for whichever block is selected on the
 * canvas. Which fields show up depends on the block's type. */
export function BlockProperties({
  block,
  onChange,
  onDelete,
}: {
  block: Block | null;
  onChange: (id: string, content: Record<string, string>) => void;
  onDelete: (id: string) => void;
}) {
  if (!block) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center rounded-lg border bg-background">
        <EmptyState
          icon={Settings2}
          title="No block selected"
          description="Select a block on the canvas to edit its properties."
        />
      </div>
    );
  }

  function set(key: string, value: string) {
    onChange(block!.id, { ...block!.content, [key]: value });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-background p-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Editing</p>
        <p className="text-sm font-semibold">{BLOCK_DEFINITIONS[block.type].label}</p>
      </div>

      <Separator />

      {block.type === "heading" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prop-text">Heading text</Label>
            <Input
              id="prop-text"
              value={block.content.text ?? ""}
              onChange={(event) => set("text", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prop-align">Alignment</Label>
            <Select value={block.content.align ?? "left"} onValueChange={(value) => set("align", value ?? "left")}>
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prop-size">Size</Label>
            <Select value={block.content.size ?? "md"} onValueChange={(value) => set("size", value ?? "md")}>
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
        </>
      )}

      {block.type === "text" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prop-text">Text</Label>
            <Textarea
              id="prop-text"
              className="min-h-24 resize-none"
              value={block.content.text ?? ""}
              onChange={(event) => set("text", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prop-align">Alignment</Label>
            <Select value={block.content.align ?? "left"} onValueChange={(value) => set("align", value ?? "left")}>
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
        </>
      )}

      {block.type === "image" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prop-url">Image URL</Label>
            <Input
              id="prop-url"
              placeholder="https://…"
              value={block.content.url ?? ""}
              onChange={(event) => set("url", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prop-alt">Alt text</Label>
            <Input
              id="prop-alt"
              value={block.content.alt ?? ""}
              onChange={(event) => set("alt", event.target.value)}
            />
          </div>
        </>
      )}

      {(block.type === "date_of_birth" || block.type === "address" || block.type === "email") && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prop-label">Field label</Label>
          <Input
            id="prop-label"
            value={block.content.label ?? ""}
            onChange={(event) => set("label", event.target.value)}
          />
        </div>
      )}

      {block.type === "button" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prop-text">Button text</Label>
            <Input
              id="prop-text"
              value={block.content.text ?? ""}
              onChange={(event) => set("text", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prop-url">Link URL</Label>
            <Input
              id="prop-url"
              placeholder="https://…"
              value={block.content.url ?? ""}
              onChange={(event) => set("url", event.target.value)}
            />
          </div>
        </>
      )}

      {block.type === "spacer" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prop-height">Height (px)</Label>
          <Input
            id="prop-height"
            type="number"
            min="8"
            value={block.content.height ?? "40"}
            onChange={(event) => set("height", event.target.value)}
          />
        </div>
      )}

      {block.type === "divider" && (
        <p className="text-sm text-muted-foreground">This block has no editable properties.</p>
      )}

      <Separator />

      <Button type="button" variant="destructive" onClick={() => onDelete(block.id)}>
        <Trash2 className="size-4" />
        Delete block
      </Button>
    </div>
  );
}
