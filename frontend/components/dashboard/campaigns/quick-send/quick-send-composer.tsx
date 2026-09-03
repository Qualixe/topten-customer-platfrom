"use client";

import { useState } from "react";

import { QuickSendAudienceSection } from "@/components/dashboard/campaigns/quick-send/quick-send-audience-section";
import { QuickSendConfirmation } from "@/components/dashboard/campaigns/quick-send/quick-send-confirmation";
import { QuickSendDetailsSection } from "@/components/dashboard/campaigns/quick-send/quick-send-details-section";
import { QuickSendMessageSection } from "@/components/dashboard/campaigns/quick-send/quick-send-message-section";
import { QuickSendSendSection } from "@/components/dashboard/campaigns/quick-send/quick-send-send-section";
import {
  createCampaign,
  type AudienceCounts,
  type AudienceRule,
  type CampaignType,
} from "@/lib/api/campaigns";
import type { Customer } from "@/lib/api/customers";
import type { SmsAccount } from "@/lib/api/sms-account";

interface QuickSendComposerProps {
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

/** The single-page alternative to CampaignComposer's 4-step wizard: every
 * section (details, audience, message, send) is visible and editable at
 * once instead of behind Back/Continue navigation — same fields, same
 * targeting options, same SMS-only default the wizard already uses, just
 * fewer clicks to get through. See app/dashboard/campaigns/quick-send. */
export function QuickSendComposer({
  audienceCounts,
  defaultSenderId,
  ratePerSegmentBdt,
  smsAccount,
}: QuickSendComposerProps) {
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
      />
    );
  }

  const canSend =
    campaignName.trim().length > 0 &&
    campaignType.length > 0 &&
    senderId.trim().length > 0 &&
    audienceRule !== null &&
    message.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
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

      <QuickSendSendSection
        recipientCount={recipientCount}
        message={message}
        ratePerSegmentBdt={ratePerSegmentBdt}
        smsAccount={smsAccount}
        canSend={canSend}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
