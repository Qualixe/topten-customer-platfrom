"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { usePermissions } from "@/components/providers/permissions-provider";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/api/types";
import {
  getBirthdaySettings,
  updateBirthdaySettings,
  type BirthdayChannel,
  type BirthdaySettings,
} from "@/lib/api/birthday-settings";
import { analyzeSmsMessage } from "@/lib/sms";

const EMPTY_SETTINGS: BirthdaySettings = {
  notifyDaysBefore: 3,
  enabled: false,
  channel: "SMS",
  sendHour: 9,
  sendMinute: 0,
  companyName: "",
  messageTemplate: "",
  emailSubject: "",
  emailMessageTemplate: "",
  autoAssignGift: false,
  lastRunAt: null,
};

const CHANNEL_OPTIONS: { value: BirthdayChannel; label: string }[] = [
  { value: "SMS", label: "SMS only" },
  { value: "EMAIL", label: "Email only" },
  { value: "BOTH", label: "SMS + Email" },
];

// The app's whole audience is Bangladesh-based, so the send time is
// collected/displayed here as Dhaka wall-clock time (UTC+6, no DST) even
// though `sendHour`/`sendMinute` are stored as UTC — the conversion is a
// fixed +/-6 hour shift, no library needed.
const BD_UTC_OFFSET_HOURS = 6;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function utcToBdTimeInputValue(sendHour: number, sendMinute: number): string {
  const bdHour = (sendHour + BD_UTC_OFFSET_HOURS + 24) % 24;
  return `${pad2(bdHour)}:${pad2(sendMinute)}`;
}

function bdTimeInputValueToUtc(value: string): { sendHour: number; sendMinute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const bdHour = Number(match[1]);
  const sendMinute = Number(match[2]);
  const sendHour = (bdHour - BD_UTC_OFFSET_HOURS + 24) % 24;
  return { sendHour, sendMinute };
}

function formatLastRun(lastRunAt: string | null): string {
  if (!lastRunAt) return "—";
  return new Date(lastRunAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function BirthdaySettingsForm() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("settings.manage");

  const [settings, setSettings] = useState<BirthdaySettings>(EMPTY_SETTINGS);
  // What's actually persisted server-side — onBlur only saves when the
  // field's value has actually changed since the last save, so tabbing
  // through untouched fields never fires a request.
  const [savedSettings, setSavedSettings] = useState<BirthdaySettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBirthdaySettings()
      .then((data) => {
        if (!cancelled) {
          setSettings(data);
          setSavedSettings(data);
        }
      })
      .catch(() => {
        // Falls back to EMPTY_SETTINGS — fields still autosave from there.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const disabled = loading || !canManage;
  const smsAnalysis = analyzeSmsMessage(settings.messageTemplate);

  async function persist(next: BirthdaySettings) {
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const result = await updateBirthdaySettings(next);
      setSettings(result);
      setSavedSettings(result);
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to save. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled(checked: boolean) {
    const next = { ...settings, enabled: checked };
    setSettings(next);
    await persist(next);
  }

  async function handleChannelChange(value: BirthdayChannel) {
    const next = { ...settings, channel: value };
    setSettings(next);
    await persist(next);
  }

  function fieldBlurHandler<K extends keyof BirthdaySettings>(key: K) {
    return () => {
      if (settings[key] === savedSettings[key]) return;
      persist(settings);
    };
  }

  const statusIndicator =
    (saving || saved) && !error ? (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {saving ? (
          "Saving…"
        ) : (
          <>
            <Check className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            Saved
          </>
        )}
      </span>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold tracking-wide uppercase">
            Birthday Automation
          </CardTitle>
          <CardDescription>
            Greetings are checked every minute and fire once per customer at your chosen time
            (Bangladesh time). Last run: {formatLastRun(settings.lastRunAt)}
          </CardDescription>
          <CardAction className="flex items-center gap-2">
            <Switch
              checked={settings.enabled}
              onCheckedChange={handleToggleEnabled}
              disabled={loading || !canManage || saving}
              aria-label="Birthday automation enabled"
            />
            <span className="text-sm text-muted-foreground">
              {settings.enabled ? "Active" : "Paused"}
            </span>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="birthday-channel">Channel</Label>
              <Select
                value={settings.channel}
                onValueChange={(value) => handleChannelChange((value ?? "SMS") as BirthdayChannel)}
                disabled={disabled}
              >
                <SelectTrigger id="birthday-channel" className="w-full">
                  <SelectValue placeholder="Select a channel" />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="birthday-send-time">Send time (Bangladesh time)</Label>
              <Input
                id="birthday-send-time"
                type="time"
                value={utcToBdTimeInputValue(settings.sendHour, settings.sendMinute)}
                disabled={disabled}
                onChange={(event) => {
                  const parsed = bdTimeInputValueToUtc(event.target.value);
                  if (!parsed) return;
                  setSettings((prev) => ({ ...prev, ...parsed }));
                }}
                onBlur={() => {
                  if (
                    settings.sendHour === savedSettings.sendHour &&
                    settings.sendMinute === savedSettings.sendMinute
                  ) {
                    return;
                  }
                  persist(settings);
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="birthday-company-name">Company name</Label>
              <Input
                id="birthday-company-name"
                value={settings.companyName}
                disabled={disabled}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, companyName: event.target.value }))
                }
                onBlur={fieldBlurHandler("companyName")}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Only admins can change birthday automation.
          </p>
          {statusIndicator}
        </CardFooter>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>SMS Message</CardTitle>
            <CardDescription>Sent via the configured SMS Gateway.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            <Label htmlFor="birthday-sms-message">Message</Label>
            <Textarea
              id="birthday-sms-message"
              rows={5}
              value={settings.messageTemplate}
              disabled={disabled}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, messageTemplate: event.target.value }))
              }
              onBlur={fieldBlurHandler("messageTemplate")}
            />
            <p className="text-xs text-muted-foreground">
              {smsAnalysis.characterCount} chars · {smsAnalysis.segmentCount} part(s) · variables{" "}
              {"{{customer_name}}"}, {"{{city}}"}, {"{{company_name}}"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Message</CardTitle>
            <CardDescription>Sent as a real Mailchimp campaign.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="birthday-email-subject">Subject</Label>
              <Input
                id="birthday-email-subject"
                value={settings.emailSubject}
                disabled={disabled}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, emailSubject: event.target.value }))
                }
                onBlur={fieldBlurHandler("emailSubject")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="birthday-email-body">Body</Label>
              <Textarea
                id="birthday-email-body"
                rows={4}
                value={settings.emailMessageTemplate}
                disabled={disabled}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, emailMessageTemplate: event.target.value }))
                }
                onBlur={fieldBlurHandler("emailMessageTemplate")}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
