import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SegmentBucket } from "@/lib/api/segments";

export function SegmentCard({
  title,
  buckets,
}: {
  title: string;
  /** `null` for a dimension the schema doesn't track yet (city, gender,
   * group, tag) — rendered as "No data yet", same as an empty list, since
   * either way there's nothing to show. */
  buckets: SegmentBucket[] | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {!buckets || buckets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          buckets.map((bucket) => (
            <div key={bucket.value} className="flex items-center justify-between gap-3">
              <span className="truncate text-sm text-foreground">{bucket.label}</span>
              <Badge variant="secondary" className="tabular-nums">
                {bucket.count}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
