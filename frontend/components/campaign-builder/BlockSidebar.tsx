import { BLOCK_DEFINITIONS, type BlockType } from "@/components/campaign-builder/types";
import { Button } from "@/components/ui/button";

/** Left column — click any component to add it to the end of the canvas. */
export function BlockSidebar({ onAddBlock }: { onAddBlock: (type: BlockType) => void }) {
  const entries = Object.entries(BLOCK_DEFINITIONS) as [BlockType, (typeof BLOCK_DEFINITIONS)[BlockType]][];

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
      <p className="px-1 text-xs font-medium text-muted-foreground">Components</p>
      {entries.map(([type, definition]) => {
        const Icon = definition.icon;
        return (
          <Button
            key={type}
            type="button"
            variant="outline"
            className="justify-start"
            onClick={() => onAddBlock(type)}
          >
            <Icon className="size-4" aria-hidden="true" />
            {definition.label}
          </Button>
        );
      })}
    </div>
  );
}
