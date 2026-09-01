"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  MessageSquare,
  Send,
  Users,
  Wallet,
} from "lucide-react";

import { MessageAnalysisBar } from "@/components/dashboard/campaigns/new/message-analysis-bar";
import { MessagePreview } from "@/components/dashboard/campaigns/new/message-preview";
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
import {
  getAudiencePreviewCount,
  type AudienceCounts,
  type AudienceRule,
  type CampaignChannel,
} from "@/lib/api/campaigns";

type SendMode = "now" | "schedule";

const STATIC_COUNT_KEY: Partial<Record<AudienceRule["ruleType"], keyof AudienceCounts>> = {
  GENERAL: "general",
  VIP: "vip",
  VVIP: "vvip",
  MISSING_DOB: "missingDob",
  MISSING_ADDRESS: "missingAddress",
  MISSING_DOB_AND_ADDRESS: "missingDobAndAddress",
};

interface StepReviewProps {
  campaignName: string;
  campaignTypeLabel: string;
  audienceLabel: string;
  audienceRule: AudienceRule;
  audienceCounts: AudienceCounts;
  channel: CampaignChannel;
  message: string;
  /** Only meaningful for SMS. */
  senderId: string;
  /** Only meaningful for EMAIL. */
  subject: string;
  /** Bulk SMS BD has no pricing API — this is the admin-configured rate
   * from settings, always a real (never mock) value. Unused for EMAIL. */
  ratePerSegmentBdt: number;
  smsAccount: SmsAccount;
  onBack: () => void;
  onSubmit: (mode: SendMode, scheduledAt?: string) => Promise<void>;
}

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
      <span className={cn("text-sm font-medium tabular-nums", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

export function StepReview({
  campaignName,
  campaignTypeLabel,
  audienceLabel,
  audienceRule,
  audienceCounts,
  channel,
  message,
  senderId,
  subject,
  ratePerSegmentBdt,
  smsAccount,
  onBack,
  onSubmit,
}: StepReviewProps) {
  const isEmail = channel === "EMAIL";
  const [sendMode, setSendMode] = useState<SendMode>("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const staticCountKey = STATIC_COUNT_KEY[audienceRule.ruleType];
  const [livePreviewCount, setLivePreviewCount] = useState<number | null>(null);

  useEffect(() => {
    // Static rules already have a known count, and SPECIFIC_CUSTOMERS'
    // count is just how many were picked — neither needs a server round trip.
    if (staticCountKey || audienceRule.ruleType === "SPECIFIC_CUSTOMERS") return;
    let cancelled = false;
    getAudiencePreviewCount(audienceRule).then((count) => {
      if (!cancelled) setLivePreviewCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [audienceRule, staticCountKey]);

  const recipientCount = staticCountKey
    ? audienceCounts[staticCountKey]
    : audienceRule.ruleType === "SPECIFIC_CUSTOMERS"
      ? audienceRule.customerIds.length
      : (livePreviewCount ?? 0);

  const analysis = analyzeSmsMessage(message);
  const { segmentCount } = analysis;
  const totalSms = segmentCount * recipientCount;
  // No per-message cost model for EMAIL — no balance to check either.
  const estimatedCost = isEmail
    ? 0
    : estimateSmsCost(segmentCount, recipientCount, ratePerSegmentBdt);
  const balanceAfter = smsAccount.balanceCredits - estimatedCost;
  const insufficientBalance = !isEmail && estimatedCost > smsAccount.balanceCredits;

  const canSubmit =
    !submitting &&
    !insufficientBalance &&
    (sendMode === "now" || (sendMode === "schedule" && scheduledAt.length > 0));

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(sendMode, sendMode === "schedule" ? scheduledAt : undefined);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save the campaign."
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-4">
          {/* Campaign summary */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign summary</CardTitle>
              <CardDescription>
                Review every detail before saving.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-0 divide-y">
              <SummaryRow
                icon={MessageSquare}
                label="Campaign"
                value={campaignName}
              />
              <SummaryRow
                icon={MessageSquare}
                label="Type"
                value={campaignTypeLabel}
              />
              {isEmail ? (
                <SummaryRow icon={Send} label="Subject" value={subject} />
              ) : (
                <SummaryRow icon={Send} label="Sender ID" value={senderId} />
              )}
              <SummaryRow
                icon={Users}
                label="Audience"
                value={audienceLabel}
              />
              <SummaryRow
                icon={Users}
                label="Recipients"
                value={recipientCount.toLocaleString("en-US")}
              />
              {!isEmail && (
                <>
                  <SummaryRow
                    icon={MessageSquare}
                    label="SMS segments per message"
                    value={segmentCount}
                  />
                  <SummaryRow
                    icon={MessageSquare}
                    label="Total SMS"
                    value={totalSms.toLocaleString("en-US")}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Cost & balance — SMS only, no per-message cost model for EMAIL */}
          {!isEmail && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
                Cost &amp; balance
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-0 divide-y">
              <SummaryRow
                icon={MessageSquare}
                label="Estimated cost"
                value={formatCurrency(estimatedCost)}
              />
              <SummaryRow
                icon={Wallet}
                label="Current balance"
                value={formatCurrency(smsAccount.balanceCredits)}
              />
              <SummaryRow
                icon={Wallet}
                label="Balance after sending"
                value={formatCurrency(Math.max(0, balanceAfter))}
                valueClassName={
                  insufficientBalance ? "text-destructive" : undefined
                }
              />
            </CardContent>

            {insufficientBalance && (
              <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Insufficient balance. You need{" "}
                  <strong>
                    {formatCurrency(estimatedCost - smsAccount.balanceCredits)}
                  </strong>{" "}
                  more to send this campaign. Top up your account first.
                </span>
              </div>
            )}
          </Card>
          )}

          {/* Message preview — encoding info */}
          <Card>
            <CardHeader>
              <CardTitle>Message</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {isEmail && subject.trim() && (
                <p className="text-sm font-medium">Subject: {subject}</p>
              )}
              <p className="rounded-lg bg-muted/50 p-3 font-mono text-sm whitespace-pre-wrap">
                {message}
              </p>
              {!isEmail && <MessageAnalysisBar analysis={analysis} />}
            </CardContent>
          </Card>

          {/* Send / schedule */}
          <Card>
            <CardHeader>
              <CardTitle>When to send</CardTitle>
              <CardDescription>
                Send immediately or schedule for a future date and time. Both
                save the campaign as scheduled — BulkSMS BD sending isn&apos;t
                connected yet.
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
                  <Label htmlFor="scheduled-at">Scheduled date &amp; time</Label>
                  <DateTimePicker
                    id="scheduled-at"
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
        </div>

        {/* Preview */}
        <div className="hidden lg:flex lg:items-start">
          <MessagePreview message={message} channel={channel} subject={subject} />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          Back
        </Button>
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
      <Icon
        className={cn(
          "size-4",
          selected ? "text-primary" : "text-muted-foreground"
        )}
        aria-hidden="true"
      />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
}
