"use client";

import { useState } from "react";

import { SettingsCard } from "@/components/dashboard/settings/settings-card";
import { FormField } from "@/components/dashboard/form-field";
import { SettingsSwitchRow } from "@/components/dashboard/settings/settings-switch-row";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { defaultBirthdaySettings } from "@/lib/mock/settings";

export function BirthdaySettingsForm() {
  const [settings, setSettings] = useState(defaultBirthdaySettings);

  return (
    <SettingsCard
      title="Birthday Settings"
      description="Control how birthday reminders and gifts are handled"
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
        description="Automatically message customers on their birthday."
        checked={settings.autoSendMessage}
        onCheckedChange={(checked) =>
          setSettings((prev) => ({ ...prev, autoSendMessage: checked }))
        }
      />

      <FormField
        htmlFor="birthday-message-template"
        label="Birthday Message Template"
        description="Use {{name}} to insert the customer's name."
      >
        <Textarea
          id="birthday-message-template"
          rows={3}
          value={settings.messageTemplate}
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
        description="Automatically queue a gift order for each birthday."
        checked={settings.autoAssignGift}
        onCheckedChange={(checked) =>
          setSettings((prev) => ({ ...prev, autoAssignGift: checked }))
        }
      />
    </SettingsCard>
  );
}
