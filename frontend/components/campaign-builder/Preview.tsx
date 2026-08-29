import { LayoutTemplate, X } from "lucide-react";

import { BlockRenderer } from "@/components/campaign-builder/blocks";
import type { Block } from "@/components/campaign-builder/types";
import { LogoMark } from "@/components/branding/logo-mark";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** Read-only render of the page as a visitor would see it — no selection
 * borders, no drag handles, form fields are enabled. Includes the real site
 * logo header so this matches what actually renders on the published page
 * (see app/campaign/[slug]/page.tsx), not just the block content. */
export function Preview({
  blocks,
  logoUrl,
  onExit,
}: {
  blocks: Block[];
  logoUrl: string | null;
  onExit: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Preview</p>
        <Button type="button" variant="outline" size="sm" onClick={onExit}>
          <X className="size-3.5" />
          Exit Preview
        </Button>
      </div>

      <div className="mx-auto w-full max-w-2xl rounded-lg border bg-background p-8 shadow-sm">
        <header className="pb-8">
          <LogoMark logoUrl={logoUrl} />
        </header>

        {blocks.length === 0 ? (
          <EmptyState
            icon={LayoutTemplate}
            title="Nothing to preview"
            description="Go back and add some blocks first."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {blocks.map((block) => (
              <BlockRenderer key={block.id} block={block} preview />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
