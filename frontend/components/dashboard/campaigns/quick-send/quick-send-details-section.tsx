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
import { CAMPAIGN_TYPE_LABELS, type CampaignType } from "@/lib/api/campaigns";

const CAMPAIGN_TYPE_OPTIONS = Object.entries(CAMPAIGN_TYPE_LABELS) as [CampaignType, string][];

/** Details section of the single-page Quick Send composer — same fields as
 * the wizard's StepDetails, minus the channel picker (this composer is
 * SMS-only, matching StepDetails' own current default) and the
 * "Continue"-gated form, since every section is visible at once here. */
export function QuickSendDetailsSection({
  name,
  onNameChange,
  campaignType,
  onCampaignTypeChange,
  senderId,
  onSenderIdChange,
}: {
  name: string;
  onNameChange: (value: string) => void;
  campaignType: CampaignType | "";
  onCampaignTypeChange: (value: CampaignType) => void;
  senderId: string;
  onSenderIdChange: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign details</CardTitle>
        <CardDescription>
          Give your campaign a descriptive name and choose what kind it is.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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

        <FormField
          htmlFor="quick-send-type"
          label="Campaign type"
          description="Used later to target customers based on which campaign types they have or haven't received."
        >
          <Select
            value={campaignType}
            onValueChange={(value) => onCampaignTypeChange(value as CampaignType)}
          >
            <SelectTrigger id="quick-send-type">
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

        <FormField htmlFor="quick-send-sender-id" label="Sender ID">
          <Input
            id="quick-send-sender-id"
            value={senderId}
            onChange={(e) => onSenderIdChange(e.target.value)}
            placeholder="e.g. TopTen"
            required
          />
        </FormField>
      </CardContent>
    </Card>
  );
}
