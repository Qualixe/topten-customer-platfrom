"use client";

import { useState } from "react";

import { SettingsCard } from "@/components/dashboard/settings/settings-card";
import { FormField } from "@/components/dashboard/form-field";
import { SettingsSwitchRow } from "@/components/dashboard/settings/settings-switch-row";
import { Input } from "@/components/ui/input";
import { defaultAccountSettings } from "@/lib/mock/settings";

export function AccountSettingsForm() {
  const [settings, setSettings] = useState(defaultAccountSettings);
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  return (
    <div className="flex flex-col gap-4">
      <SettingsCard
        title="Account Settings"
        description="Your profile information and security preferences"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField htmlFor="full-name" label="Full Name">
            <Input
              id="full-name"
              value={settings.fullName}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, fullName: event.target.value }))
              }
            />
          </FormField>

          <FormField htmlFor="role" label="Role">
            <Input id="role" value={settings.role} disabled />
          </FormField>

          <FormField htmlFor="account-email" label="Email">
            <Input
              id="account-email"
              type="email"
              value={settings.email}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, email: event.target.value }))
              }
            />
          </FormField>

          <FormField htmlFor="account-phone" label="Phone">
            <Input
              id="account-phone"
              value={settings.phone}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, phone: event.target.value }))
              }
            />
          </FormField>
        </div>

        <SettingsSwitchRow
          id="two-factor-enabled"
          label="Two-Factor Authentication"
          description="Require a verification code in addition to your password."
          checked={settings.twoFactorEnabled}
          onCheckedChange={(checked) =>
            setSettings((prev) => ({ ...prev, twoFactorEnabled: checked }))
          }
        />
      </SettingsCard>

      <SettingsCard
        title="Change Password"
        description="Update the password used to sign in to this dashboard"
      >
        <FormField htmlFor="current-password" label="Current Password">
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={passwords.current}
            onChange={(event) =>
              setPasswords((prev) => ({ ...prev, current: event.target.value }))
            }
          />
        </FormField>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField htmlFor="new-password" label="New Password">
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={passwords.next}
              onChange={(event) =>
                setPasswords((prev) => ({ ...prev, next: event.target.value }))
              }
            />
          </FormField>

          <FormField htmlFor="confirm-password" label="Confirm New Password">
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={passwords.confirm}
              onChange={(event) =>
                setPasswords((prev) => ({ ...prev, confirm: event.target.value }))
              }
            />
          </FormField>
        </div>
      </SettingsCard>
    </div>
  );
}
