import { History } from "lucide-react";

export function EmptyHistory() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <History className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium">No imports yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Upload a CSV file above to add customers in bulk. Your import history
        will show up here.
      </p>
    </div>
  );
}
