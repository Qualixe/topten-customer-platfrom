import { Info } from "lucide-react";

import { FormField } from "@/components/dashboard/form-field";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CAMPAIGN_TYPE_LABELS,
  type CampaignChannel,
  type CampaignType,
} from "@/lib/api/campaigns";
import { cn } from "@/lib/utils";

const CAMPAIGN_TYPE_OPTIONS = Object.entries(CAMPAIGN_TYPE_LABELS) as [CampaignType, string][];

const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  SMS: "SMS",
  EMAIL: "Email",
};

/** Details section shared by the single-page Quick Send composer and the
 * 2-step SimpleSendComposer ("New Campaign") — name, an optional Channel
 * (SMS/Email) picker, an optional Campaign type picker (hidden by
 * SimpleSendComposer via `hideCampaignType`, which uses Channel as its
 * only categorization instead — see DEFAULT_CAMPAIGN_TYPE there), and
 * Sender ID for SMS. */
export function QuickSendDetailsSection({
  name,
  onNameChange,
  campaignType,
  onCampaignTypeChange,
  channel = "SMS",
  onChannelChange,
  senderId,
  onSenderIdChange,
  /** Disables the Campaign type/Channel selects — set once a campaign
   * already exists, since the backend freezes both at creation (the
   * recipient snapshot is resolved from them) and rejects any change.
   * Name and Sender ID stay editable either way. */
  campaignTypeLocked = false,
  /** Hides the Campaign type select entirely — Channel (SMS/Email) is the
   * only categorization this composer surfaces; `campaignType` is still
   * tracked internally (a fixed default), just not exposed here. */
  hideCampaignType = false,
}: {
  name: string;
  onNameChange: (value: string) => void;
  campaignType: CampaignType | "";
  onCampaignTypeChange: (value: CampaignType) => void;
  channel?: CampaignChannel;
  /** Omit to hide the Channel picker entirely and stay SMS-only — used
   * only while editing an existing campaign, since channel is frozen at
   * creation just like campaign type. */
  onChannelChange?: (value: CampaignChannel) => void;
  senderId: string;
  onSenderIdChange: (value: string) => void;
  campaignTypeLocked?: boolean;
  hideCampaignType?: boolean;
}) {
  return (
    <Card>
      <CardContent
        className={cn(
          "grid grid-cols-1 gap-4 sm:grid-cols-2",
          onChannelChange ? "lg:grid-cols-4" : "lg:grid-cols-3"
        )}
      >
        <FormField htmlFor="quick-send-name" label="Campaign name">
          <Input
            id="quick-send-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Eid Collection Launch"
            autoFocus
            required
          />
        </FormField>

        {!hideCampaignType && (
          <FormField
            htmlFor="quick-send-type"
            label="Campaign type"
            description={campaignTypeLocked ? "Locked — can't change after a campaign is created." : undefined}
          >
            <Select
              value={campaignType}
              onValueChange={(value) => onCampaignTypeChange(value as CampaignType)}
              disabled={campaignTypeLocked}
            >
              <SelectTrigger id="quick-send-type" className={'w-full'}>
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {CAMPAIGN_TYPE_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}

        {onChannelChange && (
          <FormField
            htmlFor="quick-send-channel"
            label="Channel"
            description={campaignTypeLocked ? "Locked — can't change after a campaign is created." : undefined}
          >
            <Select
              value={channel}
              onValueChange={(value) => onChannelChange(value as CampaignChannel)}
              disabled={campaignTypeLocked}
            >
              <SelectTrigger id="quick-send-channel" className="w-full">
                <SelectValue>{(value: CampaignChannel) => CHANNEL_LABELS[value]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(CHANNEL_LABELS) as [CampaignChannel, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </FormField>
        )}

        {channel === "SMS" && (
          <FormField
            htmlFor="quick-send-sender-id"
            label={
              <span className="flex items-center gap-1.5">
                Sender ID
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          className="inline-flex text-muted-foreground hover:text-foreground"
                          aria-label="What is a Sender ID?"
                        />
                      }
                    >
                      <Info className="size-3.5" aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>
                      The name or number recipients see as the sender of this SMS. It must already
                      be approved with your SMS gateway provider — an unapproved ID may cause the
                      message to be blocked.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            }
          >
            <Input
              id="quick-send-sender-id"
              value={senderId}
              onChange={(e) => onSenderIdChange(e.target.value)}
              placeholder="e.g. TopTen"
              required
            />
          </FormField>
        )}
      </CardContent>
    </Card>
  );
}
