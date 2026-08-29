import type { Block } from "@/components/campaign-builder/types";
import { cn } from "@/lib/utils";

const SIZE_CLASSES: Record<string, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
};

export function HeadingBlock({ block }: { block: Block }) {
  return (
    <h2
      className={cn(
        "font-semibold tracking-tight",
        SIZE_CLASSES[block.content.size ?? "md"] ?? SIZE_CLASSES.md,
        block.content.align === "center" && "text-center",
        block.content.align === "right" && "text-right"
      )}
    >
      {block.content.text || "Heading"}
    </h2>
  );
}
