import type { Block } from "@/components/campaign-builder/types";

export function TextBlock({ block }: { block: Block }) {
  return (
    <p className="text-sm whitespace-pre-wrap text-muted-foreground">
      {block.content.text || "Text block"}
    </p>
  );
}
