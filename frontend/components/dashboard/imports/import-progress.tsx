import { Progress } from "@/components/ui/progress";

export function ImportProgress({
  fileName,
  progress,
}: {
  fileName: string;
  progress: number;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Importing {fileName}…</span>
        <span className="text-muted-foreground tabular-nums">{progress}%</span>
      </div>
      <Progress value={progress} />
      <p className="text-xs text-muted-foreground">
        Please keep this page open until the import finishes.
      </p>
    </div>
  );
}
