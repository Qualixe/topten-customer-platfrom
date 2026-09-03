"use client";

import { useState } from "react";
import { AlertTriangle, CalendarClock, MessageSquare, Send, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { analyzeSmsMessage, estimateSmsCost } from "@/lib/sms";
import { formatCurrency, type SmsAccount } from "@/lib/api/sms-account";

type SendMode = "now" | "schedule";

function SummaryRow({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {label}
      </div>
      <span className={cn("text-sm font-medium tabular-nums", valueClassName)}>{value}</span>
    </div>
  );
}

function SendModeButton({
  icon: Icon,
  label,
  description,
  selected,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border hover:border-primary/40 hover:bg-muted/50"
      )}
    >
      <Icon className={cn("size-4", selected ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
}

interface QuickSendSendSectionProps {
  /** Lifted from the audience section — null while no (complete) rule is
   * selected yet. */
  recipientCount: number | null;
  message: string;
  ratePerSegmentBdt: number;
  smsAccount: SmsAccount;
  canSend: boolean;
  onSubmit: (mode: SendMode, scheduledAt?: string) => Promise<void>;
}

/** Send section of the single-page Quick Send composer — the cost/balance
 * check and send-now/schedule action from the wizard's StepReview, without
 * the redundant "review every field again" summary cards (everything is
 * already visible above on this single page) or the Back navigation. */
export function QuickSendSendSection({
  recipientCount,
  message,
  ratePerSegmentBdt,
  smsAccount,
  canSend,
  onSubmit,
}: QuickSendSendSectionProps) {
  const [sendMode, setSendMode] = useState<SendMode>("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const analysis = analyzeSmsMessage(message);
  const { segmentCount } = analysis;
  const count = recipientCount ?? 0;
  const totalSms = segmentCount * count;
  const estimatedCost = estimateSmsCost(segmentCount, count, ratePerSegmentBdt);
  const balanceAfter = smsAccount.balanceCredits - estimatedCost;
  const insufficientBalance = estimatedCost > smsAccount.balanceCredits;

  const canSubmit =
    canSend &&
    !submitting &&
    !insufficientBalance &&
    (sendMode === "now" || (sendMode === "schedule" && scheduledAt.length > 0));

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(sendMode, sendMode === "schedule" ? scheduledAt : undefined);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save the campaign.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
            Cost &amp; balance
          </CardTitle>
          <CardDescription>
            {recipientCount === null
              ? "Choose an audience above to see recipients and cost."
              : `${count.toLocaleString("en-US")} recipients will receive this campaign.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-0 divide-y">
          <SummaryRow icon={MessageSquare} label="SMS segments per message" value={segmentCount} />
          <SummaryRow icon={MessageSquare} label="Total SMS" value={totalSms.toLocaleString("en-US")} />
          <SummaryRow icon={MessageSquare} label="Estimated cost" value={formatCurrency(estimatedCost)} />
          <SummaryRow icon={Wallet} label="Current balance" value={formatCurrency(smsAccount.balanceCredits)} />
          <SummaryRow
            icon={Wallet}
            label="Balance after sending"
            value={formatCurrency(Math.max(0, balanceAfter))}
            valueClassName={insufficientBalance ? "text-destructive" : undefined}
          />
        </CardContent>

        {insufficientBalance && (
          <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Insufficient balance. You need{" "}
              <strong>{formatCurrency(estimatedCost - smsAccount.balanceCredits)}</strong> more to
              send this campaign. Top up your account first.
            </span>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to send</CardTitle>
          <CardDescription>
            Send immediately or schedule for a future date and time. Both save the campaign as
            scheduled — BulkSMS BD sending isn&apos;t connected yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <SendModeButton
              icon={Send}
              label="Send now"
              description="Saves for immediate sending"
              selected={sendMode === "now"}
              onClick={() => setSendMode("now")}
            />
            <SendModeButton
              icon={CalendarClock}
              label="Schedule"
              description="Pick a date & time"
              selected={sendMode === "schedule"}
              onClick={() => setSendMode("schedule")}
            />
          </div>

          {sendMode === "schedule" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quick-send-scheduled-at">Scheduled date &amp; time</Label>
              <DateTimePicker
                id="quick-send-scheduled-at"
                value={scheduledAt}
                onChange={setScheduledAt}
                required
              />
            </div>
          )}

          {submitError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          variant={insufficientBalance ? "destructive" : "default"}
        >
          {insufficientBalance ? (
            <>
              <AlertTriangle className="size-4" />
              Insufficient balance
            </>
          ) : sendMode === "schedule" ? (
            <>
              <CalendarClock className="size-4" />
              {submitting ? "Scheduling…" : "Schedule campaign"}
            </>
          ) : (
            <>
              <Send className="size-4" />
              {submitting ? "Saving…" : "Save campaign"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
