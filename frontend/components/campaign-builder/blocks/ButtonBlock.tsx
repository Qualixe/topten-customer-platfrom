import { Button } from "@/components/ui/button";
import type { Block } from "@/components/campaign-builder/types";

export function ButtonBlock({ block }: { block: Block }) {
  return <Button type="button">{block.content.text || "Button"}</Button>;
}
