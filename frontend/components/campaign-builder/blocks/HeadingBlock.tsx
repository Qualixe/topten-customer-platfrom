import type { Block } from "@/components/campaign-builder/types";

export function HeadingBlock({ block }: { block: Block }) {
  return <h2 className="text-2xl font-semibold tracking-tight">{block.content.text || "Heading"}</h2>;
}
