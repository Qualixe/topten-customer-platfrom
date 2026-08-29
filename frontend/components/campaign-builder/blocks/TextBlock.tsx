import type { Block } from "@/components/campaign-builder/types";
import { cn } from "@/lib/utils";

export function TextBlock({ block }: { block: Block }) {
  return (
    <p
      className={cn(
        "text-sm whitespace-pre-wrap text-muted-foreground",
        block.content.align === "center" && "text-center",
        block.content.align === "right" && "text-right"
      )}
    >
      {block.content.text || "Text block"}
    </p>
  );
}
