import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Block } from "@/components/campaign-builder/types";

/** A form field placeholder — the visitor fills this in on the real landing
 * page, so it's disabled everywhere except preview mode. */
export function DobBlock({ block, preview = false }: { block: Block; preview?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{block.content.label || "Date of Birth"}</Label>
      <Input type="date" disabled={!preview} />
    </div>
  );
}
