"use client";

import { useRef, useState, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UploadArea({
  onFileSelected,
  disabled,
}: {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const file = event.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-border",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <UploadCloud className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium">
          Drag and drop your CSV file here
        </p>
        <p className="text-sm text-muted-foreground">
          or click below to browse your files
        </p>
      </div>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Browse Files
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelected(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
