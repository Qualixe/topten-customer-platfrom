"use client";

import { useEffect, useState } from "react";

import { SettingsCard } from "@/components/dashboard/settings/settings-card";
import { FormField } from "@/components/dashboard/form-field";
import { SettingsSwitchRow } from "@/components/dashboard/settings/settings-switch-row";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getBirthdaySettings,
  updateBirthdaySettings,
  type BirthdaySettings,
} from "@/lib/api/birthday-settings";

const EMPTY_SETTINGS: BirthdaySettings = {
  notifyDaysBefore: 3,
  autoSendMessage: false,
  messageTemplate: "",
  autoSendEmail: false,
  emailSubject: "",
  emailMessageTemplate: "",
  autoAssignGift: false,
};

export function BirthdaySettingsForm() {
  const [settings, setSettings] = useState<BirthdaySettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);

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

  return (
    <SettingsCard
      title="Birthday Settings"
      description="Control how birthday reminders and gifts are handled"
      onSave={handleSave}
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
        label="Auto-Send Birthday SMS"
        description="Automatically message customers on their birthday, via SMS."
        checked={settings.autoSendMessage}
        onCheckedChange={(checked) =>
          setSettings((prev) => ({ ...prev, autoSendMessage: checked }))
        }
      />

      <FormField
        htmlFor="birthday-message-template"
        label="Birthday SMS Template"
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
        id="auto-send-birthday-email"
        label="Auto-Send Birthday Email"
        description="Automatically email customers on their birthday, via Mailchimp."
        checked={settings.autoSendEmail}
        onCheckedChange={(checked) =>
          setSettings((prev) => ({ ...prev, autoSendEmail: checked }))
        }
      />

      <FormField
        htmlFor="birthday-email-subject"
        label="Birthday Email Subject"
        description="Use {{customer_name}} to insert the customer's name."
      >
        <Input
          id="birthday-email-subject"
          value={settings.emailSubject}
          disabled={loading}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, emailSubject: event.target.value }))
          }
        />
      </FormField>

      <FormField
        htmlFor="birthday-email-template"
        label="Birthday Email Body"
        description="HTML sent via Mailchimp. Use {{customer_name}} to insert the customer's name."
      >
        <Textarea
          id="birthday-email-template"
          rows={4}
          value={settings.emailMessageTemplate}
          disabled={loading}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, emailMessageTemplate: event.target.value }))
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
