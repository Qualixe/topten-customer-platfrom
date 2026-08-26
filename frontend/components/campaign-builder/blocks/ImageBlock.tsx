import Image from "next/image";
import { ImageIcon } from "lucide-react";

import type { Block } from "@/components/campaign-builder/types";

export function ImageBlock({ block }: { block: Block }) {
  const url = block.content.url;

  if (!url) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-muted text-muted-foreground">
        <ImageIcon className="size-5" aria-hidden="true" />
        <span className="text-xs">No image URL set</span>
      </div>
    );
  }

  return (
    <div className="relative h-48 w-full overflow-hidden rounded-md bg-muted">
      <Image src={url} alt={block.content.alt || ""} fill unoptimized className="object-cover" />
    </div>
  );
}
