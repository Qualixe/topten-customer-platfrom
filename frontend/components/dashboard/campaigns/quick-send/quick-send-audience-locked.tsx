import { Users } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Stands in for QuickSendAudienceSection when editing an existing
 * campaign — the recipient snapshot is frozen at creation and the backend
 * rejects any attempt to change the rule that produced it (422), so
 * there's nothing to pick here, just what was already resolved. */
export function QuickSendAudienceLocked({
  audienceLabel,
  recipientCount,
}: {
  audienceLabel: string;
  recipientCount: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audience</CardTitle>
        <CardDescription>
          Locked — the recipient list was frozen when this campaign was created and can&apos;t be
          changed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <Users className="size-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">{audienceLabel}</p>
            <p className="text-xs text-muted-foreground">
              {recipientCount.toLocaleString("en-US")} recipients
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
