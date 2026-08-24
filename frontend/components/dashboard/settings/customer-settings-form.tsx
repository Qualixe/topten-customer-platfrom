"use client";

import { useState } from "react";

import { SettingsCard } from "@/components/dashboard/settings/settings-card";
import { FormField } from "@/components/dashboard/form-field";
import { SettingsSwitchRow } from "@/components/dashboard/settings/settings-switch-row";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defaultCustomerSettings } from "@/lib/mock/settings";

export function CustomerSettingsForm() {
  const [settings, setSettings] = useState(defaultCustomerSettings);

  return (
    <SettingsCard
      title="Customer Settings"
      description="Defaults applied when customers are added to the platform"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          htmlFor="customer-id-prefix"
          label="Customer ID Prefix"
          description="Used when generating new customer IDs."
        >
          <Input
            id="customer-id-prefix"
            value={settings.customerIdPrefix}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                customerIdPrefix: event.target.value,
              }))
            }
          />
        </FormField>

        <FormField htmlFor="default-status" label="Default Customer Status">
          <Select
            value={settings.defaultStatus}
            onValueChange={(value) =>
              setSettings((prev) => ({ ...prev, defaultStatus: value as string }))
            }
          >
            <SelectTrigger id="default-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <FormField
        htmlFor="min-age"
        label="Minimum Age Requirement"
        description="Customers below this age cannot be registered."
      >
        <Input
          id="min-age"
          type="number"
          min={0}
          className="max-w-32"
          value={settings.minAgeRequirement}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              minAgeRequirement: Number(event.target.value),
            }))
          }
        />
      </FormField>

      <SettingsSwitchRow
        id="allow-duplicate-emails"
        label="Allow Duplicate Emails"
        description="Permit multiple customer profiles to share the same email address."
        checked={settings.allowDuplicateEmails}
        onCheckedChange={(checked) =>
          setSettings((prev) => ({ ...prev, allowDuplicateEmails: checked }))
        }
      />
    </SettingsCard>
  );
}
