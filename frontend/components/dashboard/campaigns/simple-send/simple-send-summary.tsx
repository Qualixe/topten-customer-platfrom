import { MessageSquare, Send, Users } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {label}
      </div>
      <span className="max-w-[60%] truncate text-right text-sm font-medium">{value}</span>
    </div>
  );
}

/** Compact recap of what was filled in on step 1 — step 2 is a separate
 * screen, so (unlike Quick Send's single page) those fields aren't visible
 * anymore without this. Cost, balance, and recipient count live in
 * QuickSendSendSection below this, not duplicated here. */
export function SimpleSendSummary({
  campaignName,
  campaignTypeLabel,
  audienceLabel,
  senderId,
}: {
  campaignName: string;
  campaignTypeLabel: string;
  audienceLabel: string;
  senderId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign summary</CardTitle>
        <CardDescription>Review the details from the previous step.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-0 divide-y">
        <SummaryRow icon={MessageSquare} label="Campaign" value={campaignName} />
        <SummaryRow icon={MessageSquare} label="Type" value={campaignTypeLabel} />
        <SummaryRow icon={Users} label="Audience" value={audienceLabel} />
        <SummaryRow icon={Send} label="Sender ID" value={senderId} />
      </CardContent>
    </Card>
  );
}
