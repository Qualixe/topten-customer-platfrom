"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SaveStatus = "saved" | "unsaved" | "saving";

const SAVE_STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Saved",
  unsaved: "Unsaved changes",
  saving: "Saving…",
};

export function FormToolbar({
  name,
  onNameChange,
  saveStatus,
  onSave,
  previewMode,
  onTogglePreview,
  onBack,
  canManage = true,
  extraAction,
}: {
  name: string;
  onNameChange: (value: string) => void;
  saveStatus: SaveStatus;
  onSave: () => void;
  previewMode: boolean;
  onTogglePreview: () => void;
  onBack: () => void;
  /** Whether Save is available at all — a view-only user can still Preview. */
  canManage?: boolean;
  /** Extra button rendered next to Preview, e.g. "Send via Campaign". */
  extraAction?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" aria-label="Back to forms" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          className="w-56"
          aria-label="Form name"
          disabled={previewMode || !canManage}
        />
      </div>

      <div className="flex items-center gap-3">
        {canManage && <p className="text-xs text-muted-foreground">{SAVE_STATUS_LABEL[saveStatus]}</p>}
        <Button type="button" variant="outline" onClick={onTogglePreview}>
          {previewMode ? "Edit" : "Preview"}
        </Button>
        {!previewMode && canManage && extraAction}
        {!previewMode && canManage && (
          <Button
            type="button"
            onClick={onSave}
            disabled={saveStatus !== "unsaved" || !name.trim()}
          >
            {saveStatus === "saving" ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
    </div>
  );
}
