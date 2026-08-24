"use client";

import { useState } from "react";

import { AccountSettingsForm } from "@/components/dashboard/settings/account-settings-form";
import { BirthdaySettingsForm } from "@/components/dashboard/settings/birthday-settings-form";
import { CourierSettingsForm } from "@/components/dashboard/settings/courier-settings-form";
import { CustomerSettingsForm } from "@/components/dashboard/settings/customer-settings-form";
import { GeneralSettingsForm } from "@/components/dashboard/settings/general-settings-form";
import { NotificationSettingsForm } from "@/components/dashboard/settings/notification-settings-form";
import { PathaoCredentialsForm } from "@/components/dashboard/settings/pathao-credentials-form";
import { SmsGatewayCredentialsForm } from "@/components/dashboard/settings/sms-gateway-credentials-form";
import { UsersSettings } from "@/components/dashboard/settings/users-settings";
import { VipSettingsForm } from "@/components/dashboard/settings/vip-settings-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SECTIONS = [
  { value: "general", label: "General" },
  { value: "customers", label: "Customers" },
  { value: "birthdays", label: "Birthdays" },
  { value: "vip", label: "VIP" },
  { value: "notifications", label: "Notifications" },
  { value: "couriers", label: "Couriers" },
  { value: "integrations", label: "API Credentials" },
  { value: "users", label: "Users" },
  { value: "account", label: "Account" },
] as const;

export function SettingsTabs() {
  const [tab, setTab] = useState<string>("general");

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as string)}>
      <TabsList className="flex-wrap">
        {SECTIONS.map((section) => (
          <TabsTrigger key={section.value} value={section.value}>
            {section.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="general" keepMounted className="mt-2">
        <GeneralSettingsForm />
      </TabsContent>
      <TabsContent value="customers" keepMounted className="mt-2">
        <CustomerSettingsForm />
      </TabsContent>
      <TabsContent value="birthdays" keepMounted className="mt-2">
        <BirthdaySettingsForm />
      </TabsContent>
      <TabsContent value="vip" keepMounted className="mt-2">
        <VipSettingsForm />
      </TabsContent>
      <TabsContent value="notifications" keepMounted className="mt-2">
        <NotificationSettingsForm />
      </TabsContent>
      <TabsContent value="couriers" keepMounted className="mt-2">
        <CourierSettingsForm />
      </TabsContent>
      <TabsContent value="integrations" keepMounted className="mt-2 flex flex-col gap-6">
        <SmsGatewayCredentialsForm />
        <PathaoCredentialsForm />
      </TabsContent>
      <TabsContent value="users" keepMounted className="mt-2">
        <UsersSettings />
      </TabsContent>
      <TabsContent value="account" keepMounted className="mt-2">
        <AccountSettingsForm />
      </TabsContent>
    </Tabs>
  );
}
