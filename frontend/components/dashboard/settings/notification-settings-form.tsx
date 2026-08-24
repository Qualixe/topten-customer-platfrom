"use client";

import { useState } from "react";

import { SettingsCard } from "@/components/dashboard/settings/settings-card";
import { FormField } from "@/components/dashboard/form-field";
import { SettingsSwitchRow } from "@/components/dashboard/settings/settings-switch-row";
import { Input } from "@/components/ui/input";
import { defaultNotificationSettings } from "@/lib/mock/settings";

export function NotificationSettingsForm() {
  const [settings, setSettings] = useState(defaultNotificationSettings);

  return (
    <SettingsCard
      title="Notification Settings"
      description="Choose which channels are used to reach customers"
    >
      <SettingsSwitchRow
        id="sms-enabled"
        label="SMS Notifications"
        description="Send text messages for birthdays, gifts, and updates."
        checked={settings.smsEnabled}
        onCheckedChange={(checked) =>
          setSettings((prev) => ({ ...prev, smsEnabled: checked }))
        }
      />
      <SettingsSwitchRow
        id="email-enabled"
        label="Email Notifications"
        description="Send email updates and campaign messages."
        checked={settings.emailEnabled}
        onCheckedChange={(checked) =>
          setSettings((prev) => ({ ...prev, emailEnabled: checked }))
        }
      />
      <SettingsSwitchRow
        id="whatsapp-enabled"
        label="WhatsApp Notifications"
        description="Send messages to customers via WhatsApp Business."
        checked={settings.whatsappEnabled}
        onCheckedChange={(checked) =>
          setSettings((prev) => ({ ...prev, whatsappEnabled: checked }))
        }
      />

      <FormField
        htmlFor="default-sender-name"
        label="Default Sender Name"
        description="Shown as the sender on outgoing messages."
      >
        <Input
          id="default-sender-name"
          value={settings.defaultSenderName}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              defaultSenderName: event.target.value,
            }))
          }
        />
      </FormField>

      <SettingsSwitchRow
        id="respect-quiet-hours"
        label="Respect Quiet Hours"
        description="Delay non-urgent notifications during quiet hours."
        checked={settings.respectQuietHours}
        onCheckedChange={(checked) =>
          setSettings((prev) => ({ ...prev, respectQuietHours: checked }))
        }
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField htmlFor="quiet-hours-start" label="Quiet Hours Start">
          <Input
            id="quiet-hours-start"
            type="time"
            value={settings.quietHoursStart}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                quietHoursStart: event.target.value,
              }))
            }
          />
        </FormField>

        <FormField htmlFor="quiet-hours-end" label="Quiet Hours End">
          <Input
            id="quiet-hours-end"
            type="time"
            value={settings.quietHoursEnd}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                quietHoursEnd: event.target.value,
              }))
            }
          />
        </FormField>
      </div>
    </SettingsCard>
  );
}
