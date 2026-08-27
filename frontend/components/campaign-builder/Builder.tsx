"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Eye } from "lucide-react";

import { BlockProperties } from "@/components/campaign-builder/BlockProperties";
import { BlockSidebar } from "@/components/campaign-builder/BlockSidebar";
import { BuilderCanvas } from "@/components/campaign-builder/BuilderCanvas";
import { Preview } from "@/components/campaign-builder/Preview";
import { BLOCK_DEFINITIONS, type Block, type BlockType } from "@/components/campaign-builder/types";
import { usePermissions } from "@/components/providers/permissions-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createCampaignLandingPage,
  updateCampaignLandingPage,
  type CampaignLandingPage,
} from "@/lib/api/campaign-landing-pages";
import { getErrorMessage } from "@/lib/api/types";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The landing page builder. Block editing state (blocks, selection,
 * preview) lives here; page settings (name/slug/published) live here too
 * since Save needs all of it at once. */
export function Builder({
  campaignId,
  campaignName,
  initialLandingPage,
}: {
  campaignId: string;
  campaignName: string;
  initialLandingPage: CampaignLandingPage | null;
}) {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("campaigns.manage");

  const [landingPage, setLandingPage] = useState(initialLandingPage);
  const [blocks, setBlocks] = useState<Block[]>(initialLandingPage?.builderData.blocks ?? []);
  const [name, setName] = useState(initialLandingPage?.name ?? `${campaignName} Landing Page`);
  const [slug, setSlug] = useState(initialLandingPage?.slug ?? slugify(campaignName));
  const [published, setPublished] = useState(initialLandingPage?.published ?? false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

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

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSavedMessage(null);

    const input = { name, slug, builderData: { version: 1, blocks }, published };

    try {
      const saved = landingPage
        ? await updateCampaignLandingPage(campaignId, input)
        : await createCampaignLandingPage(campaignId, input);
      setLandingPage(saved);
      setSavedMessage("Saved.");
    } catch (err) {
      setSaveError(getErrorMessage(err, "Unable to save the landing page. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
            <p className="text-sm text-muted-foreground">Campaign: {campaignName}</p>
          </div>
        </div>

        {!previewMode && (
          <Button type="button" variant="outline" onClick={() => setPreviewMode(true)}>
            <Eye className="size-4" />
            Preview
          </Button>
        )}
      </div>

      {!previewMode && canManage && (
        <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-end sm:gap-4">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="landing-page-name">Page name</Label>
            <Input id="landing-page-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="landing-page-slug">Slug (in the public URL)</Label>
            <Input
              id="landing-page-slug"
              value={slug}
              onChange={(event) => setSlug(slugify(event.target.value))}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="landing-page-published" checked={published} onCheckedChange={setPublished} />
            <Label htmlFor="landing-page-published">Published</Label>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button type="button" onClick={handleSave} disabled={saving || !name || !slug}>
              {saving ? "Saving…" : "Save"}
            </Button>
            {savedMessage && <p className="text-xs text-muted-foreground">{savedMessage}</p>}
          </div>
        </div>
      )}
      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      {previewMode ? (
        <Preview blocks={blocks} onExit={() => setPreviewMode(false)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr_300px]">
          {canManage && <BlockSidebar onAddBlock={handleAddBlock} />}

          <div
            className={
              canManage ? "max-h-[calc(100vh-320px)] overflow-y-auto" : "lg:col-span-2 lg:col-start-1"
            }
          >
            <BuilderCanvas
              blocks={blocks}
              selectedId={canManage ? selectedId : null}
              onSelect={canManage ? setSelectedId : () => {}}
              onDelete={handleDelete}
              onReorder={handleReorder}
            />
          </div>

          {canManage && (
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
              <BlockProperties
                block={selectedBlock}
                onChange={handleContentChange}
                onDelete={handleDelete}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
