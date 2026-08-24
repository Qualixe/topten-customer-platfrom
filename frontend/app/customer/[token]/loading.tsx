import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerProfileLoading() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-6">
      <div className="flex items-center justify-center gap-2 py-6">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="flex flex-col items-center gap-2 px-1">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="flex flex-col gap-6 rounded-2xl border bg-card p-5 sm:p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
