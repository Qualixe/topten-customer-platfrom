import Link from "next/link";
import { CalendarClock, CheckCircle2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

interface StepConfirmationProps {
  campaignName: string;
  mode: "now" | "schedule";
  scheduledAt?: string;
  recipientCount: number;
  /** Form field types the campaign landing page couldn't represent (e.g.
   * "Phone Number") and so left out — the live page won't match the form
   * this campaign was built from unless the admin knows to account for it. */
  skippedFieldLabels: string[];
}

export function StepConfirmation({
  campaignName,
  mode,
  scheduledAt,
  recipientCount,
  skippedFieldLabels,
}: StepConfirmationProps) {
  const isScheduled = mode === "schedule";
  const Icon = isScheduled ? CalendarClock : CheckCircle2;
  const iconColor = isScheduled ? "text-sky-500" : "text-emerald-500";

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-6 py-10 text-center">
        {/* Icon */}
        <span className="flex size-16 items-center justify-center rounded-full bg-muted">
          <Icon className={`size-8 ${iconColor}`} aria-hidden="true" />
        </span>

        {/* Heading */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xl font-semibold">
            {isScheduled ? "Campaign scheduled!" : "Campaign saved!"}
          </h3>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{campaignName}</span>{" "}
            {isScheduled ? (
              <>
                has been scheduled for{" "}
                <span className="font-medium text-foreground">
                  {scheduledAt}
                </span>{" "}
                to reach{" "}
                <span className="font-medium text-foreground">
                  {recipientCount.toLocaleString("en-US")} recipients
                </span>
                .
              </>
            ) : (
              <>
                has been saved for{" "}
                <span className="font-medium text-foreground">
                  {recipientCount.toLocaleString("en-US")} recipients
                </span>
                .
              </>
            )}
          </p>
        </div>

        {/* Note about pending integration */}
        <p className="rounded-lg bg-muted px-4 py-2 text-xs text-muted-foreground">
          No SMS has been sent — BulkSMS BD sending isn&apos;t connected yet.
        </p>

        {skippedFieldLabels.length > 0 && (
          <p className="text-sm text-muted-foreground">
            These form fields aren&apos;t supported on campaign landing pages yet and were left
            out: <strong>{skippedFieldLabels.join(", ")}</strong>. The live page won&apos;t
            collect them.
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 w-full sm:flex-row sm:justify-center">
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/campaigns/new" />}
            variant="outline"
          >
            <Send className="size-4" />
            New campaign
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/campaigns" />}
          >
            View all campaigns
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
