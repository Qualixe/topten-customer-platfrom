import { AddressBlock } from "@/components/campaign-builder/blocks/AddressBlock";
import { ButtonBlock } from "@/components/campaign-builder/blocks/ButtonBlock";
import { DividerBlock } from "@/components/campaign-builder/blocks/DividerBlock";
import { DobBlock } from "@/components/campaign-builder/blocks/DobBlock";
import { EmailBlock } from "@/components/campaign-builder/blocks/EmailBlock";
import { HeadingBlock } from "@/components/campaign-builder/blocks/HeadingBlock";
import { ImageBlock } from "@/components/campaign-builder/blocks/ImageBlock";
import { SpacerBlock } from "@/components/campaign-builder/blocks/SpacerBlock";
import { TextBlock } from "@/components/campaign-builder/blocks/TextBlock";
import type { Block } from "@/components/campaign-builder/types";

/** Picks the right renderer for a block's type. `preview` is passed through
 * to the few block types that look different on the real page (form fields
 * become enabled, the spacer becomes truly blank). */
export function BlockRenderer({ block, preview = false }: { block: Block; preview?: boolean }) {
  switch (block.type) {
    case "heading":
      return <HeadingBlock block={block} />;
    case "text":
      return <TextBlock block={block} />;
    case "image":
      return <ImageBlock block={block} />;
    case "dob":
      return <DobBlock block={block} preview={preview} />;
    case "address":
      return <AddressBlock block={block} preview={preview} />;
    case "email":
      return <EmailBlock block={block} preview={preview} />;
    case "button":
      return <ButtonBlock block={block} />;
    case "divider":
      return <DividerBlock />;
    case "spacer":
      return <SpacerBlock block={block} preview={preview} />;
    default:
      return null;
  }
}
