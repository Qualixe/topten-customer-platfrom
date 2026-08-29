"use client";

import { useState } from "react";

import { StepIndicator, type StepId } from "@/components/dashboard/campaigns/new/step-indicator";
import { StepDetails } from "@/components/dashboard/campaigns/new/step-details";
import { StepAudience } from "@/components/dashboard/campaigns/new/step-audience";
import { StepMessage } from "@/components/dashboard/campaigns/new/step-message";
import { StepReview } from "@/components/dashboard/campaigns/new/step-review";
import { StepConfirmation } from "@/components/dashboard/campaigns/new/step-confirmation";
import { Separator } from "@/components/ui/separator";
import {
  CAMPAIGN_TYPE_LABELS,
  createCampaign,
  type AudienceCounts,
  type AudienceRule,
  type CampaignType,
} from "@/lib/api/campaigns";
import type { Customer } from "@/lib/api/customers";
import type { SmsAccount } from "@/lib/api/sms-account";

interface CampaignComposerProps {
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
  GENERAL: "General customers",
  VIP: "VIP customers",
  VVIP: "VVIP customers",
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

export function CampaignComposer({
  audienceCounts,
  defaultSenderId,
  ratePerSegmentBdt,
  smsAccount,
}: CampaignComposerProps) {
  // Step navigation
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [maxReached, setMaxReached] = useState<StepId>(1);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(
    null
  );

  // Form state
  const [campaignName, setCampaignName] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType | "">("");
  const [senderId, setSenderId] = useState(defaultSenderId);
  const [audienceRule, setAudienceRule] = useState<AudienceRule | null>(null);
  const [pickedCustomers, setPickedCustomers] = useState<Customer[]>([]);
  const [message, setMessage] = useState("");
  const [formId, setFormId] = useState("");

  function goToStep(step: StepId) {
    setCurrentStep(step);
    if (step > maxReached) setMaxReached(step);
  }

  function next() {
    goToStep((currentStep + 1) as StepId);
  }

  function back() {
    goToStep((currentStep - 1) as StepId);
  }

  async function handleSubmit(mode: "now" | "schedule", scheduledAt?: string) {
    if (!audienceRule || !campaignType) return;

    const scheduledAtIso =
      mode === "now" ? new Date().toISOString() : new Date(scheduledAt!).toISOString();

    const { campaign, skippedFieldLabels } = await createCampaign({
      name: campaignName,
      campaignType,
      audienceRule,
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

  // Confirmation screen
  if (confirmation) {
    return (
      <StepConfirmation
        campaignName={campaignName}
        mode={confirmation.mode}
        scheduledAt={confirmation.scheduledAt}
        recipientCount={confirmation.recipientCount}
        skippedFieldLabels={confirmation.skippedFieldLabels}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center">
        <StepIndicator
          current={currentStep}
          onStepClick={goToStep}
          maxReached={maxReached}
        />
      </div>

      <Separator />

      {/* Step content */}
      {currentStep === 1 && (
        <StepDetails
          name={campaignName}
          onNameChange={setCampaignName}
          campaignType={campaignType}
          onCampaignTypeChange={setCampaignType}
          senderId={senderId}
          onSenderIdChange={setSenderId}
          onNext={next}
        />
      )}

      {currentStep === 2 && (
        <StepAudience
          counts={audienceCounts}
          rule={audienceRule}
          onRuleChange={(rule) => {
            setAudienceRule(rule);
          }}
          pickedCustomers={pickedCustomers}
          onPickedCustomersChange={setPickedCustomers}
          onBack={back}
          onNext={next}
        />
      )}

      {currentStep === 3 && (
        <StepMessage
          message={message}
          onMessageChange={setMessage}
          formId={formId}
          onFormIdChange={setFormId}
          onBack={back}
          onNext={next}
        />
      )}

      {currentStep === 4 && audienceRule && campaignType && (
        <StepReview
          campaignName={campaignName}
          campaignTypeLabel={CAMPAIGN_TYPE_LABELS[campaignType]}
          audienceLabel={describeAudienceRule(audienceRule)}
          audienceRule={audienceRule}
          audienceCounts={audienceCounts}
          message={message}
          senderId={senderId}
          ratePerSegmentBdt={ratePerSegmentBdt}
          smsAccount={smsAccount}
          onBack={back}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
