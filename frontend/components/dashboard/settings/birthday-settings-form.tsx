"use client";

import { useEffect, useState } from "react";
import { Check, Send } from "lucide-react";

import { SettingsCard } from "@/components/dashboard/settings/settings-card";
import { FormField } from "@/components/dashboard/form-field";
import { SettingsSwitchRow } from "@/components/dashboard/settings/settings-switch-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getBirthdaySettings,
  sendBirthdayWishesNow,
  updateBirthdaySettings,
  type BirthdaySettings,
} from "@/lib/api/birthday-settings";
import { getErrorMessage } from "@/lib/api/types";

const EMPTY_SETTINGS: BirthdaySettings = {
  notifyDaysBefore: 3,
  autoSendMessage: false,
  messageTemplate: "",
  autoAssignGift: false,
};

export function BirthdaySettingsForm() {
  const [settings, setSettings] = useState<BirthdaySettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);

  const [sendingNow, setSendingNow] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBirthdaySettings()
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch(() => {
        // Falls back to EMPTY_SETTINGS — Save still works from there.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    const saved = await updateBirthdaySettings(settings);
    setSettings(saved);
  }

  async function handleSendNow() {
    setSendingNow(true);
    setSendError(null);
    setSendResult(null);
    try {
      const report = await sendBirthdayWishesNow();
      setSendResult(
        report.total === 0
          ? "No customers have a birthday today."
          : `Sent to ${report.sent} of ${report.total}` +
              (report.skippedAlreadySent > 0 ? ` (${report.skippedAlreadySent} already wished this year)` : "") +
              (report.failed > 0 ? `, ${report.failed} failed` : "") +
              "."
      );
    } catch (err) {
      setSendError(getErrorMessage(err, "Unable to reach the API server. Please try again."));
    } finally {
      setSendingNow(false);
    }
  }

  return (
    <SettingsCard
      title="Birthday Settings"
      description="Control how birthday reminders and gifts are handled"
      onSave={handleSave}
      footerExtra={
        <div className="mr-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!settings.autoSendMessage || sendingNow || loading}
            onClick={handleSendNow}
          >
            <Send className="size-3.5" aria-hidden="true" />
            {sendingNow ? "Sending…" : "Send now"}
          </Button>
          {sendResult && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <Check className="size-3.5" aria-hidden="true" />
              {sendResult}
            </span>
          )}
          {sendError && <span className="text-xs text-destructive">{sendError}</span>}
        </div>
      }
    >
      <FormField
        htmlFor="notify-days-before"
        label="Notify Days Before Birthday"
        description="How many days in advance to flag an upcoming birthday."
      >
        <Input
          id="notify-days-before"
          type="number"
          min={0}
          max={30}
          className="max-w-32"
          value={settings.notifyDaysBefore}
          disabled={loading}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              notifyDaysBefore: Number(event.target.value),
            }))
          }
        />
      </FormField>

      <SettingsSwitchRow
        id="auto-send-birthday-message"
        label="Auto-Send Birthday Message"
        description="Automatically message customers on their birthday, via SMS."
        checked={settings.autoSendMessage}
        onCheckedChange={(checked) =>
          setSettings((prev) => ({ ...prev, autoSendMessage: checked }))
        }
      />

      <FormField
        htmlFor="birthday-message-template"
        label="Birthday Message Template"
        description="Use {{customer_name}} to insert the customer's name."
      >
        <Textarea
          id="birthday-message-template"
          rows={3}
          value={settings.messageTemplate}
          disabled={loading}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              messageTemplate: event.target.value,
            }))
          }
        />
      </FormField>

      <SettingsSwitchRow
        id="auto-assign-gift"
        label="Auto-Assign Birthday Gift"
        description="Automatically queue a gift order for each birthday. (Coming soon — saved but not yet acted on.)"
        checked={settings.autoAssignGift}
        onCheckedChange={(checked) =>
          setSettings((prev) => ({ ...prev, autoAssignGift: checked }))
        }
      />
    </SettingsCard>
  );
}
