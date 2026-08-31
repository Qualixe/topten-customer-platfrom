import { FormField } from "@/components/dashboard/form-field";
import { Button } from "@/components/ui/button";
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
import { CAMPAIGN_TYPE_LABELS, type CampaignChannel, type CampaignType } from "@/lib/api/campaigns";

const CAMPAIGN_TYPE_OPTIONS = Object.entries(CAMPAIGN_TYPE_LABELS) as [CampaignType, string][];

const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  SMS: "SMS",
  EMAIL: "Email",
};

interface StepDetailsProps {
  name: string;
  onNameChange: (value: string) => void;
  campaignType: CampaignType | "";
  onCampaignTypeChange: (value: CampaignType) => void;
  channel: CampaignChannel;
  onChannelChange: (value: CampaignChannel) => void;
  senderId: string;
  onSenderIdChange: (value: string) => void;
  onNext: () => void;
}

export function StepDetails({
  name,
  onNameChange,
  campaignType,
  onCampaignTypeChange,
  channel,
  onChannelChange,
  senderId,
  onSenderIdChange,
  onNext,
}: StepDetailsProps) {
  const canContinue =
    name.trim().length > 0 &&
    campaignType.length > 0 &&
    (channel === "EMAIL" || senderId.trim().length > 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (canContinue) onNext();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Campaign details</CardTitle>
          <CardDescription>
            Give your campaign a descriptive name, choose what kind of
            campaign it is and which channel it sends through.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormField htmlFor="campaign-name" label="Campaign name">
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Eid Collection Launch"
              autoFocus
              required
            />
          </FormField>

          <FormField htmlFor="campaign-channel" label="Channel">
            <Select value={channel} onValueChange={(value) => onChannelChange(value as CampaignChannel)}>
              <SelectTrigger id="campaign-channel">
                <SelectValue>{(value: CampaignChannel) => CHANNEL_LABELS[value]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SMS">SMS</SelectItem>
                <SelectItem value="EMAIL">Email</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            htmlFor="campaign-type"
            label="Campaign type"
            description="Used later to target customers based on which campaign types they have or haven't received."
          >
            <Select
              value={campaignType}
              onValueChange={(value) => onCampaignTypeChange(value as CampaignType)}
            >
              <SelectTrigger id="campaign-type">
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

          {channel === "SMS" && (
            <FormField htmlFor="campaign-sender-id" label="Sender ID">
              <Input
                id="campaign-sender-id"
                value={senderId}
                onChange={(e) => onSenderIdChange(e.target.value)}
                placeholder="e.g. TopTen"
                required
              />
            </FormField>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={!canContinue}>
          Continue to Audience
        </Button>
      </div>
    </form>
  );
}
