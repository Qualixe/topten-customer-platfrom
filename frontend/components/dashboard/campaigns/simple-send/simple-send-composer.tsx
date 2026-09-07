
"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { describeAudience, useCustomerTypeNames } from "@/components/dashboard/campaigns/campaign-export";
import { QuickSendAudienceLocked } from "@/components/dashboard/campaigns/quick-send/quick-send-audience-locked";
import { QuickSendAudienceSection } from "@/components/dashboard/campaigns/quick-send/quick-send-audience-section";
import { QuickSendConfirmation } from "@/components/dashboard/campaigns/quick-send/quick-send-confirmation";
import { QuickSendDetailsSection } from "@/components/dashboard/campaigns/quick-send/quick-send-details-section";
import { QuickSendEmailMessageSection } from "@/components/dashboard/campaigns/quick-send/quick-send-email-message-section";
import { QuickSendMessageSection } from "@/components/dashboard/campaigns/quick-send/quick-send-message-section";
import { QuickSendSendSection } from "@/components/dashboard/campaigns/quick-send/quick-send-send-section";
import { SimpleSendStepIndicator, type SimpleSendStepId } from "@/components/dashboard/campaigns/simple-send/simple-send-step-indicator";
import { SimpleSendSummary } from "@/components/dashboard/campaigns/simple-send/simple-send-summary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CAMPAIGN_TYPE_LABELS,
  createCampaign,
  updateCampaign,
  type AudienceCounts,
  type AudienceRule,
  type CampaignChannel,
  type CampaignType,
  type SmsCampaign,
} from "@/lib/api/campaigns";
import type { Customer } from "@/lib/api/customers";
import type { SmsAccount } from "@/lib/api/sms-account";

/** This composer no longer asks for a Campaign type — Channel (SMS/Email)
 * is the only categorization it surfaces (see QuickSendDetailsSection's
 * `hideCampaignType`). `campaignType` is still a required field on the
 * backend (used by the NEVER_RECEIVED_TYPE / RECEIVED_TYPE_BEFORE_DATE
 * audience rules), so every campaign created here is just tagged with
 * this fixed default rather than exposing a choice nobody asked for. */
const DEFAULT_CAMPAIGN_TYPE: CampaignType = "PROMOTIONAL";

interface SimpleSendComposerProps {
  audienceCounts: AudienceCounts;
  defaultSenderId: string;
  /** Bulk SMS BD has no pricing API — this is the admin-configured rate
   * from settings, always a real (never mock) value. */
  ratePerSegmentBdt: number;
  smsAccount: SmsAccount;
  /** When set, this composer edits that existing campaign instead of
   * creating a new one — same two steps, but the campaign type is locked
   * and the audience is shown read-only, since both are frozen
   * server-side once a campaign exists. */
  editCampaign?: SmsCampaign;
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

/** Converts an ISO datetime string to the "YYYY-MM-DDTHH:mm" local format
 * DateTimePicker expects — never a plain slice of the ISO string, which is
 * UTC and would shift the displayed day/time by the viewer's timezone
 * offset. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The middle-ground campaign flow between the full 4-step builder
 * (/dashboard/campaigns/new) and the single-page Quick Send composer
 * (/dashboard/campaigns/quick-send): one step to fill in everything
 * (details, audience, message — the exact same sections Quick Send uses),
 * one step to review and send. See app/dashboard/campaigns/send. This is
 * the primary "New Campaign" entry point, so — unlike Quick Send — it
 * doesn't ask for a Campaign type at all; Channel (SMS/Email) is the only
 * categorization shown, and every campaign gets a fixed campaign type
 * behind the scenes (see DEFAULT_CAMPAIGN_TYPE above). Also doubles as the
 * edit flow for an existing campaign (see `editCampaign`), with Channel
 * locked the same way Campaign type used to be (frozen server-side). */
export function SimpleSendComposer({
  audienceCounts,
  defaultSenderId,
  ratePerSegmentBdt,
  smsAccount,
  editCampaign,
}: SimpleSendComposerProps) {
  const router = useRouter();
  const isEditing = editCampaign !== undefined;
  const typeNames = useCustomerTypeNames();

  const [step, setStep] = useState<SimpleSendStepId>(1);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

  const [campaignName, setCampaignName] = useState(editCampaign?.name ?? "");
  const [campaignType, setCampaignType] = useState<CampaignType>(
    editCampaign?.campaignType ?? DEFAULT_CAMPAIGN_TYPE
  );
  const [channel, setChannel] = useState<CampaignChannel>(editCampaign?.channel ?? "SMS");
  const [senderId, setSenderId] = useState(editCampaign?.senderId ?? defaultSenderId);
  const [audienceRule, setAudienceRule] = useState<AudienceRule | null>(null);
  const [pickedCustomers, setPickedCustomers] = useState<Customer[]>([]);
  const [recipientCount, setRecipientCount] = useState<number | null>(
    editCampaign?.totalRecipients ?? null
  );
  const [message, setMessage] = useState(editCampaign?.channel === "EMAIL" ? "" : (editCampaign?.message ?? ""));
  const [subject, setSubject] = useState(editCampaign?.subject ?? "");
  const [htmlBody, setHtmlBody] = useState(
    editCampaign?.channel === "EMAIL" ? (editCampaign?.message ?? "") : ""
  );
  const [formId, setFormId] = useState("");

  const isEmail = channel === "EMAIL";

  async function handleSubmit(mode: "now" | "schedule", scheduledAt?: string) {
    const scheduledAtIso =
      mode === "now" ? new Date().toISOString() : new Date(scheduledAt!).toISOString();

    if (isEditing && editCampaign) {
      const updated = await updateCampaign(editCampaign.id, {
        name: campaignName,
        message: isEmail ? htmlBody : message,
        senderId: isEmail ? undefined : senderId,
        subject: isEmail ? subject : undefined,
        scheduledAt: scheduledAtIso,
        status: "SCHEDULED",
      });
      router.push(`/dashboard/campaigns/${updated.id}`);
      router.refresh();
      return;
    }

    if (!audienceRule) return;

    const { campaign, skippedFieldLabels } = await createCampaign({
      name: campaignName,
      campaignType,
      audienceRule,
      channel,
      message: isEmail ? htmlBody : message,
      senderId: isEmail ? undefined : senderId,
      subject: isEmail ? subject : undefined,
      scheduledAt: scheduledAtIso,
      status: "SCHEDULED",
      // A Form's attached landing page only applies to the SMS
      // {{form_link}} pipeline — Mailchimp emails have no per-campaign
      // landing page/token concept.
      formId: isEmail ? undefined : formId || undefined,
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
    (isEditing || audienceRule !== null) &&
    (isEmail
      ? subject.trim().length > 0 && htmlBody.trim().length > 0
      : senderId.trim().length > 0 && message.trim().length > 0);

  const canSend = canContinue;

  const audienceLabel = isEditing
    ? describeAudience(editCampaign, typeNames)
    : audienceRule
      ? describeAudienceRule(audienceRule)
      : "";

  const backHref = isEditing ? `/dashboard/campaigns/${editCampaign.id}` : "/dashboard/campaigns";

  return (
    <div className="flex flex-col gap-3">
      <Card className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              render={<Link href={backHref} aria-label="Back" />}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {isEditing ? "Edit Campaign" : "New Campaign"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isEditing
                  ? "Update the details, message, and schedule for this campaign."
                  : "Fill in your campaign, then review and send — two steps, start to finish."}
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
            hideCampaignType
            channel={channel}
            onChannelChange={isEditing ? undefined : setChannel}
            senderId={senderId}
            onSenderIdChange={setSenderId}
            campaignTypeLocked={isEditing}
          />

          {isEditing && editCampaign ? (
            <QuickSendAudienceLocked
              audienceLabel={audienceLabel}
              recipientCount={editCampaign.totalRecipients}
            />
          ) : (
            <QuickSendAudienceSection
              counts={audienceCounts}
              rule={audienceRule}
              onRuleChange={setAudienceRule}
              pickedCustomers={pickedCustomers}
              onPickedCustomersChange={setPickedCustomers}
              onRecipientCountChange={setRecipientCount}
              channel={channel}
            />
          )}

          {isEmail ? (
            <QuickSendEmailMessageSection
              subject={subject}
              onSubjectChange={setSubject}
              htmlBody={htmlBody}
              onHtmlBodyChange={setHtmlBody}
            />
          ) : (
            <QuickSendMessageSection
              message={message}
              onMessageChange={setMessage}
              formId={formId}
              onFormIdChange={setFormId}
            />
          )}

          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={!canContinue}>
              Continue to Review
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (isEditing || audienceRule) && (
        <div className="flex flex-col gap-3">
          <SimpleSendSummary
            campaignName={campaignName}
            audienceLabel={audienceLabel}
            channel={channel}
            senderId={senderId}
            subject={subject}
          />

          <QuickSendSendSection
            recipientCount={recipientCount}
            message={isEmail ? htmlBody : message}
            ratePerSegmentBdt={ratePerSegmentBdt}
            smsAccount={smsAccount}
            canSend={canSend}
            channel={channel}
            onSubmit={handleSubmit}
            onBack={() => setStep(1)}
            initialSendMode={isEditing && editCampaign?.scheduledAt ? "schedule" : "now"}
            initialScheduledAt={isEditing ? isoToLocalInput(editCampaign!.scheduledAt) : undefined}
          />
        </div>
      )}
    </div>
  );
}
