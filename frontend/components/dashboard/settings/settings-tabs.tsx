"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  Cake,
  Crown,
  KeyRound,
  SlidersHorizontal,
  Truck,
  User,
  UserCog,
  Users,
} from "lucide-react";

import { AccountSettingsForm } from "@/components/dashboard/settings/account-settings-form";
import { BirthdaySettingsForm } from "@/components/dashboard/settings/birthday-settings-form";
import { CustomerSettingsForm } from "@/components/dashboard/settings/customer-settings-form";
import { DatabaseResetCard } from "@/components/dashboard/settings/database-reset-card";
import { EmailCredentialsForm } from "@/components/dashboard/settings/email-credentials-form";
import { GeneralSettingsForm } from "@/components/dashboard/settings/general-settings-form";
import { NotificationSettingsForm } from "@/components/dashboard/settings/notification-settings-form";
import { PathaoCredentialsForm } from "@/components/dashboard/settings/pathao-credentials-form";
import { SmsGatewayCredentialsForm } from "@/components/dashboard/settings/sms-gateway-credentials-form";
import { UsersSettings } from "@/components/dashboard/settings/users-settings";
import { VipSettingsForm } from "@/components/dashboard/settings/vip-settings-form";
import { usePermissions } from "@/components/providers/permissions-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SECTIONS = [
  { value: "general", label: "General", icon: SlidersHorizontal },
  { value: "customers", label: "Customers", icon: Users },
  { value: "birthdays", label: "Birthdays", icon: Cake },
  { value: "vip", label: "VIP", icon: Crown },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "couriers", label: "Couriers", icon: Truck },
  { value: "integrations", label: "API Credentials", icon: KeyRound },
  { value: "users", label: "Users", icon: UserCog },
  { value: "account", label: "Account", icon: User },
] as const;

export function SettingsTabs() {
  const [tab, setTab] = useState<string>("general");
  const { hasPermission } = usePermissions();
  // Hidden entirely rather than shown-but-403 like the rest of this tab
  // list — everything else here relies on the backend to reject an
  // unauthorized action after the fact, but a database wipe is severe
  // enough that someone without the permission shouldn't even see the
  // button exists.
  const canResetDatabase = hasPermission("database.reset");

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as string)}
      orientation="vertical"
      className="items-start"
    >
      <TabsList className="w-48 shrink-0">
        {SECTIONS.map((section) => (
          <TabsTrigger key={section.value} value={section.value}>
            <section.icon />
            {section.label}
          </TabsTrigger>
        ))}
        {canResetDatabase && (
          <TabsTrigger value="danger-zone" className="text-destructive">
            <AlertTriangle />
            Danger Zone
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="general" keepMounted>
        <GeneralSettingsForm />
      </TabsContent>
      <TabsContent value="customers" keepMounted>
        <CustomerSettingsForm />
      </TabsContent>
      <TabsContent value="birthdays" keepMounted>
        <BirthdaySettingsForm />
      </TabsContent>
      <TabsContent value="vip" keepMounted>
        <VipSettingsForm />
      </TabsContent>
      <TabsContent value="notifications" keepMounted>
        <NotificationSettingsForm />
      </TabsContent>
      <TabsContent value="couriers" keepMounted>
        <PathaoCredentialsForm />
      </TabsContent>
      <TabsContent value="integrations" keepMounted className="flex flex-col gap-6">
        <SmsGatewayCredentialsForm />
        <EmailCredentialsForm />
      </TabsContent>
      <TabsContent value="users" keepMounted>
        <UsersSettings />
      </TabsContent>
      <TabsContent value="account" keepMounted>
        <AccountSettingsForm />
      </TabsContent>
      {canResetDatabase && (
        <TabsContent value="danger-zone" keepMounted>
          <DatabaseResetCard />
        </TabsContent>
      )}
    </Tabs>
  );
}
