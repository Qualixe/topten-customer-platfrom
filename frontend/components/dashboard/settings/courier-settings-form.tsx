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
import { Textarea } from "@/components/ui/textarea";
import { defaultCourierSettings } from "@/lib/mock/settings";

export function CourierSettingsForm() {
  const [settings, setSettings] = useState(defaultCourierSettings);

  return (
    <SettingsCard
      title="Courier Settings"
      description="Defaults used when dispatching gift deliveries"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField htmlFor="default-courier" label="Default Courier">
          <Select
            value={settings.defaultCourier}
            onValueChange={(value) =>
              setSettings((prev) => ({ ...prev, defaultCourier: value as string }))
            }
          >
            <SelectTrigger id="default-courier" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Pathao">Pathao</SelectItem>
              <SelectItem value="RedX">RedX</SelectItem>
              <SelectItem value="Paperfly">Paperfly</SelectItem>
              <SelectItem value="Sundarban Courier">Sundarban Courier</SelectItem>
              <SelectItem value="eCourier">eCourier</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          htmlFor="delivery-sla-days"
          label="Delivery SLA (days)"
          description="Expected delivery time shown to customers."
        >
          <Input
            id="delivery-sla-days"
            type="number"
            min={1}
            max={14}
            value={settings.deliverySlaDays}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                deliverySlaDays: Number(event.target.value),
              }))
            }
          />
        </FormField>
      </div>

      <SettingsSwitchRow
        id="auto-assign-courier"
        label="Auto-Assign Courier"
        description="Automatically pick a courier when a gift order is scheduled."
        checked={settings.autoAssignCourier}
        onCheckedChange={(checked) =>
          setSettings((prev) => ({ ...prev, autoAssignCourier: checked }))
        }
      />

      <FormField
        htmlFor="packaging-notes"
        label="Packaging Notes"
        description="Included on the packing slip for every delivery."
      >
        <Textarea
          id="packaging-notes"
          rows={3}
          value={settings.packagingNotes}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              packagingNotes: event.target.value,
            }))
          }
        />
      </FormField>
    </SettingsCard>
  );
}
