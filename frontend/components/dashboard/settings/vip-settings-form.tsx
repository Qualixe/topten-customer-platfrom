"use client";

import { useState } from "react";

import { SettingsCard } from "@/components/dashboard/settings/settings-card";
import { FormField } from "@/components/dashboard/form-field";
import { SettingsSwitchRow } from "@/components/dashboard/settings/settings-switch-row";
import { Input } from "@/components/ui/input";
import { defaultVipSettings } from "@/lib/mock/settings";

export function VipSettingsForm() {
  const [settings, setSettings] = useState(defaultVipSettings);

  return (
    <SettingsCard
      title="VIP Settings"
      description="Spending thresholds used to identify VIP customers"
    >
      <FormField
        htmlFor="vip-spending-threshold"
        label="VIP Spending Threshold (৳)"
        description="Minimum lifetime spend to qualify as a VIP customer."
      >
        <Input
          id="vip-spending-threshold"
          type="number"
          min={0}
          value={settings.vipSpendingThreshold}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              vipSpendingThreshold: Number(event.target.value),
            }))
          }
        />
      </FormField>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          htmlFor="gold-threshold"
          label="Gold Tier Threshold (৳)"
        >
          <Input
            id="gold-threshold"
            type="number"
            min={0}
            value={settings.goldThreshold}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                goldThreshold: Number(event.target.value),
              }))
            }
          />
        </FormField>

        <FormField
          htmlFor="platinum-threshold"
          label="Platinum Tier Threshold (৳)"
        >
          <Input
            id="platinum-threshold"
            type="number"
            min={0}
            value={settings.platinumThreshold}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                platinumThreshold: Number(event.target.value),
              }))
            }
          />
        </FormField>
      </div>

      <SettingsSwitchRow
        id="auto-upgrade-customers"
        label="Auto-Upgrade Customers"
        description="Automatically move customers into VIP tiers once they cross a threshold."
        checked={settings.autoUpgradeCustomers}
        onCheckedChange={(checked) =>
          setSettings((prev) => ({ ...prev, autoUpgradeCustomers: checked }))
        }
      />
    </SettingsCard>
  );
}
