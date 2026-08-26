"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Eye } from "lucide-react";

import { BlockProperties } from "@/components/campaign-builder/BlockProperties";
import { BlockSidebar } from "@/components/campaign-builder/BlockSidebar";
import { BuilderCanvas } from "@/components/campaign-builder/BuilderCanvas";
import { Preview } from "@/components/campaign-builder/Preview";
import { BLOCK_DEFINITIONS, type Block, type BlockType } from "@/components/campaign-builder/types";
import { Button } from "@/components/ui/button";

/** Frontend-only landing page builder. All state lives here and is passed
 * down as props — nothing is persisted or sent to the backend yet. */
export function Builder({ campaignId }: { campaignId: string }) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const selectedBlock = blocks.find((block) => block.id === selectedId) ?? null;

  function handleAddBlock(type: BlockType) {
    const newBlock: Block = {
      id: crypto.randomUUID(),
      type,
      content: { ...BLOCK_DEFINITIONS[type].defaultContent },
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedId(newBlock.id);
  }

  function handleDelete(id: string) {
    setBlocks((prev) => prev.filter((block) => block.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }

  function handleReorder(fromId: string, toId: string) {
    setBlocks((prev) => {
      const fromIndex = prev.findIndex((block) => block.id === fromId);
      const toIndex = prev.findIndex((block) => block.id === toId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleContentChange(id: string, content: Record<string, string>) {
    setBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, content } : block)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href="/dashboard/campaigns" aria-label="Back to campaigns" />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Landing Page Builder</h2>
            <p className="text-sm text-muted-foreground">Campaign {campaignId}</p>
          </div>
        </div>

        {!previewMode && (
          <Button type="button" variant="outline" onClick={() => setPreviewMode(true)}>
            <Eye className="size-4" />
            Preview
          </Button>
        )}
      </div>

      {previewMode ? (
        <Preview blocks={blocks} onExit={() => setPreviewMode(false)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr_300px]">
          <BlockSidebar onAddBlock={handleAddBlock} />

          <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
            <BuilderCanvas
              blocks={blocks}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDelete={handleDelete}
              onReorder={handleReorder}
            />
          </div>

          <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
            <BlockProperties block={selectedBlock} onChange={handleContentChange} onDelete={handleDelete} />
          </div>
        </div>
      )}
    </div>
  );
}
