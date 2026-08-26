import type { Block } from "@/components/campaign-builder/types";

/** In the editor this shows a visible placeholder so it's editable/selectable;
 * in preview it's a plain blank gap, matching the real landing page. */
export function SpacerBlock({ block, preview = false }: { block: Block; preview?: boolean }) {
  const height = Number(block.content.height) || 40;

  if (preview) {
    return <div style={{ height }} />;
  }

  return (
    <div
      style={{ height }}
      className="flex items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground"
    >
      Spacer ({height}px)
    </div>
  );
}
