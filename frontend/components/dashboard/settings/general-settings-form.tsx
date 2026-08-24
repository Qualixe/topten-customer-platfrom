"use client";

import { useState } from "react";

import { SettingsCard } from "@/components/dashboard/settings/settings-card";
import { FormField } from "@/components/dashboard/form-field";
import { SettingsSwitchRow } from "@/components/dashboard/settings/settings-switch-row";
import { SiteLogoUpload } from "@/components/dashboard/settings/site-logo-upload";
import { Input } from "@/components/ui/input";
import { defaultGeneralSettings } from "@/lib/mock/settings";

export function GeneralSettingsForm() {
  const [settings, setSettings] = useState(defaultGeneralSettings);

  return (
    <SettingsCard
      title="General Settings"
      description="Basic information about your store"
    >
      <SiteLogoUpload />

      <FormField htmlFor="store-name" label="Store Name">
        <Input
          id="store-name"
          value={settings.storeName}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, storeName: event.target.value }))
          }
        />
      </FormField>

      <FormField htmlFor="support-email" label="Support Email">
        <Input
          id="support-email"
          type="email"
          value={settings.supportEmail}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, supportEmail: event.target.value }))
          }
        />
      </FormField>

      <p className="text-xs text-muted-foreground">
        This store always operates in Bangladeshi Taka (৳) on Asia/Dhaka time
        (GMT+6) — not configurable.
      </p>

      <SettingsSwitchRow
        id="maintenance-mode"
        label="Maintenance Mode"
        description="Temporarily disable customer-facing features while you make changes."
        checked={settings.maintenanceMode}
        onCheckedChange={(checked) =>
          setSettings((prev) => ({ ...prev, maintenanceMode: checked }))
        }
      />
    </SettingsCard>
  );
}
