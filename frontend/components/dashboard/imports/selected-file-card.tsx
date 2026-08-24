import { CheckCircle2, FileSpreadsheet, Loader2, X, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/mock/imports";

export type FileValidationState = "validating" | "valid" | "invalid";

export function SelectedFileCard({
  file,
  validationState,
  validationError,
  importing,
  onStartImport,
  onRemove,
}: {
  file: File;
  validationState: FileValidationState;
  validationError?: string;
  importing: boolean;
  onStartImport: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <FileSpreadsheet className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.size)}
          </p>
        </div>
        {!importing && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Remove file"
            onClick={onRemove}
          >
            <X />
          </Button>
        )}
      </div>

      {validationState === "validating" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Validating file…
        </p>
      )}

      {validationState === "valid" && (
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            File looks good and is ready to import.
          </p>
          <Button onClick={onStartImport} disabled={importing}>
            Start Import
          </Button>
        </div>
      )}

      {validationState === "invalid" && (
        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>File validation failed</AlertTitle>
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
