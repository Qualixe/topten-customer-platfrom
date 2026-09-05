"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { QuickSendAudienceSection } from "@/components/dashboard/campaigns/quick-send/quick-send-audience-section";
import { QuickSendConfirmation } from "@/components/dashboard/campaigns/quick-send/quick-send-confirmation";
import { QuickSendDetailsSection } from "@/components/dashboard/campaigns/quick-send/quick-send-details-section";
import { QuickSendMessageSection } from "@/components/dashboard/campaigns/quick-send/quick-send-message-section";
import { QuickSendSendSection } from "@/components/dashboard/campaigns/quick-send/quick-send-send-section";
import { SimpleSendStepIndicator, type SimpleSendStepId } from "@/components/dashboard/campaigns/simple-send/simple-send-step-indicator";
import { SimpleSendSummary } from "@/components/dashboard/campaigns/simple-send/simple-send-summary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CAMPAIGN_TYPE_LABELS,
  createCampaign,
  type AudienceCounts,
  type AudienceRule,
  type CampaignType,
} from "@/lib/api/campaigns";
import type { Customer } from "@/lib/api/customers";
import type { SmsAccount } from "@/lib/api/sms-account";

interface SimpleSendComposerProps {
  audienceCounts: AudienceCounts;
  defaultSenderId: string;
  /** Bulk SMS BD has no pricing API — this is the admin-configured rate
   * from settings, always a real (never mock) value. */
  ratePerSegmentBdt: number;
  smsAccount: SmsAccount;
}

interface ConfirmationState {
  mode: "now" | "schedule";
  scheduledAt?: string;
  recipientCount: number;
  skippedFieldLabels: string[];
}

const AUDIENCE_LABEL: Record<AudienceRule["ruleType"], string> = {
  // Kept only so pre-CUSTOMER_TYPE campaigns still resolve — never produced
  // by this composer itself, see AudienceRuleType's docstring.
  GENERAL: "General customers",
  VIP: "VIP customers",
  VVIP: "VVIP customers",
  CUSTOMER_TYPE: "Customer type",
  MISSING_DOB: "Missing date of birth",
  MISSING_ADDRESS: "Missing address",
  MISSING_DOB_AND_ADDRESS: "Missing DOB & address",
  NEW_SINCE_DATE: "New customers since a date",
  NEVER_RECEIVED_TYPE: "Never received a campaign type",
  RECEIVED_TYPE_BEFORE_DATE: "Received a campaign type before a date",
  SPECIFIC_CUSTOMERS: "Specific customers",
  NEVER_VERIFIED: "Never verified any profile form",
  TARGETED_NOT_VERIFIED: "Targeted but not yet verified",
};

function describeAudienceRule(rule: AudienceRule): string {
  const base = AUDIENCE_LABEL[rule.ruleType];
  if (rule.ruleType === "CUSTOMER_TYPE") return rule.customerTypeName || base;
  if (rule.ruleType === "NEW_SINCE_DATE") return `${base} (${rule.sinceDate})`;
  if (rule.ruleType === "NEVER_RECEIVED_TYPE") {
    return `${base}: ${CAMPAIGN_TYPE_LABELS[rule.campaignType]}`;
  }
  if (rule.ruleType === "RECEIVED_TYPE_BEFORE_DATE") {
    return `${base}: ${CAMPAIGN_TYPE_LABELS[rule.campaignType]} before ${rule.beforeDate}`;
  }
  if (rule.ruleType === "SPECIFIC_CUSTOMERS") return `${base} (${rule.customerIds.length})`;
  return base;
}

/** The middle-ground campaign flow between the full 4-step builder
 * (/dashboard/campaigns/new) and the single-page Quick Send composer
 * (/dashboard/campaigns/quick-send): one step to fill in everything
 * (details, audience, message — the exact same sections Quick Send uses),
 * one step to review and send. See app/dashboard/campaigns/send. */
export function SimpleSendComposer({
  audienceCounts,
  defaultSenderId,
  ratePerSegmentBdt,
  smsAccount,
}: SimpleSendComposerProps) {
  const [step, setStep] = useState<SimpleSendStepId>(1);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

  const [campaignName, setCampaignName] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType | "">("");
  const [senderId, setSenderId] = useState(defaultSenderId);
  const [audienceRule, setAudienceRule] = useState<AudienceRule | null>(null);
  const [pickedCustomers, setPickedCustomers] = useState<Customer[]>([]);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [formId, setFormId] = useState("");

  async function handleSubmit(mode: "now" | "schedule", scheduledAt?: string) {
    if (!audienceRule || !campaignType) return;

    const scheduledAtIso =
      mode === "now" ? new Date().toISOString() : new Date(scheduledAt!).toISOString();

    const { campaign, skippedFieldLabels } = await createCampaign({
      name: campaignName,
      campaignType,
      audienceRule,
      channel: "SMS",
      message,
      senderId,
      scheduledAt: scheduledAtIso,
      status: "SCHEDULED",
      formId: formId || undefined,
    });

    setConfirmation({
      mode,
      scheduledAt,
      recipientCount: campaign.totalRecipients,
      skippedFieldLabels,
    });
  }

  if (confirmation) {
    return (
      <QuickSendConfirmation
        campaignName={campaignName}
        mode={confirmation.mode}
        scheduledAt={confirmation.scheduledAt}
        recipientCount={confirmation.recipientCount}
        skippedFieldLabels={confirmation.skippedFieldLabels}
        newCampaignHref="/dashboard/campaigns/send"
      />
    );
  }

  const canContinue =
    campaignName.trim().length > 0 &&
    campaignType.length > 0 &&
    senderId.trim().length > 0 &&
    audienceRule !== null &&
    message.trim().length > 0;

  const canSend = canContinue;

  return (
    <div className="flex flex-col gap-3">
      <Card className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              render={<Link href="/dashboard/campaigns" aria-label="Back to campaigns" />}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">New Campaign</h2>
              <p className="text-sm text-muted-foreground">
                Fill in your campaign, then review and send — two steps, start to finish.
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <SimpleSendStepIndicator current={step} />
          </div>

          <div className="flex flex-1 justify-center sm:justify-end">
            {step === 1 && (
              <Button className="max-sm:w-full" onClick={() => setStep(2)} disabled={!canContinue}>
                Continue to Review
              </Button>
            )}
          </div>
        </div>
      </Card>

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <QuickSendDetailsSection
            name={campaignName}
            onNameChange={setCampaignName}
            campaignType={campaignType}
            onCampaignTypeChange={setCampaignType}
            senderId={senderId}
            onSenderIdChange={setSenderId}
          />

          <QuickSendAudienceSection
            counts={audienceCounts}
            rule={audienceRule}
            onRuleChange={setAudienceRule}
            pickedCustomers={pickedCustomers}
            onPickedCustomersChange={setPickedCustomers}
            onRecipientCountChange={setRecipientCount}
          />

          <QuickSendMessageSection
            message={message}
            onMessageChange={setMessage}
            formId={formId}
            onFormIdChange={setFormId}
          />

          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={!canContinue}>
              Continue to Review
            </Button>
          </div>
        </div>
      )}

      {step === 2 && campaignType && audienceRule && (
        <div className="flex flex-col gap-3">
          <SimpleSendSummary
            campaignName={campaignName}
            campaignTypeLabel={CAMPAIGN_TYPE_LABELS[campaignType]}
            audienceLabel={describeAudienceRule(audienceRule)}
            senderId={senderId}
          />

          <QuickSendSendSection
            recipientCount={recipientCount}
            message={message}
            ratePerSegmentBdt={ratePerSegmentBdt}
            smsAccount={smsAccount}
            canSend={canSend}
            onSubmit={handleSubmit}
            onBack={() => setStep(1)}
          />
        </div>
      )}
    </div>
  );
}
