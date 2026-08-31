import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewGiftLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 shrink-0 rounded-md" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 shrink-0 rounded-lg" />
            <Skeleton className="h-9 w-40" />
          </div>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="h-9 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}
