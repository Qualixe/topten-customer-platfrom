"use client";

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
}: {
  name: string;
  onNameChange: (value: string) => void;
  saveStatus: SaveStatus;
  onSave: () => void;
  previewMode: boolean;
  onTogglePreview: () => void;
  onBack: () => void;
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
          disabled={previewMode}
        />
      </div>

      <div className="flex items-center gap-3">
        <p className="text-xs text-muted-foreground">{SAVE_STATUS_LABEL[saveStatus]}</p>
        <Button type="button" variant="outline" onClick={onTogglePreview}>
          {previewMode ? "Edit" : "Preview"}
        </Button>
        {!previewMode && (
          <Button type="button" onClick={onSave} disabled={saveStatus === "saving"}>
            {saveStatus === "saving" ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
    </div>
  );
}
