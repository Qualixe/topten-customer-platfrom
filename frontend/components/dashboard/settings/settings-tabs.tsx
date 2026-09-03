"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  Cake,
  Crown,
  KeyRound,
  MessageSquare,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  User,
  UserCog,
  Users,
} from "lucide-react";

import { AccountSettingsForm } from "@/components/dashboard/settings/account-settings-form";
import { BirthdaySettingsForm } from "@/components/dashboard/settings/birthday-settings-form";
import { CustomerSettingsForm } from "@/components/dashboard/settings/customer-settings-form";
import { CustomerTypesSettings } from "@/components/dashboard/settings/customer-types-settings";
import { DatabaseResetCard } from "@/components/dashboard/settings/database-reset-card";
import { GeneralSettingsForm } from "@/components/dashboard/settings/general-settings-form";
import { NotificationSettingsForm } from "@/components/dashboard/settings/notification-settings-form";
import { PathaoCredentialsForm } from "@/components/dashboard/settings/pathao-credentials-form";
import { SendGridMarketingCredentialsForm } from "@/components/dashboard/settings/sendgrid-marketing-credentials-form";
import { SmsGatewayCredentialsForm } from "@/components/dashboard/settings/sms-gateway-credentials-form";
import { UsersSettings } from "@/components/dashboard/settings/users-settings";
import { VipSettingsForm } from "@/components/dashboard/settings/vip-settings-form";
import { usePermissions } from "@/components/providers/permissions-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const CREDENTIAL_TABS = [
  { value: "sms", label: "SMS Gateway", icon: MessageSquare },
  { value: "marketing", label: "Marketing", icon: ShoppingBag },
] as const;

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

const TAB_VALUES = new Set<string>([...SECTIONS.map((section) => section.value), "danger-zone"]);

export function SettingsTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission } = usePermissions();
  // Hidden entirely rather than shown-but-403 like the rest of this tab
  // list — everything else here relies on the backend to reject an
  // unauthorized action after the fact, but a database wipe is severe
  // enough that someone without the permission shouldn't even see the
  // button exists.
  const canResetDatabase = hasPermission("database.reset");

  const requestedTab = searchParams.get("tab");
  const tab =
    requestedTab && TAB_VALUES.has(requestedTab) && (requestedTab !== "danger-zone" || canResetDatabase)
      ? requestedTab
      : "general";

  const [credentialTab, setCredentialTab] = useState<"sms" | "marketing">("sms");

  function setTab(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "general") params.delete("tab");
    else params.set("tab", value);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as string)}
      orientation="vertical"
      className="items-start"
    >
      <TabsList className="w-48 shrink-0 gap-1">
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
      <TabsContent value="customers" keepMounted className="flex flex-col gap-6">
        <CustomerTypesSettings />
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
        <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-[3px]">
          {CREDENTIAL_TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setCredentialTab(item.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-all",
                "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
                credentialTab === item.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-foreground/60 hover:text-foreground"
              )}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
        </div>
        {credentialTab === "sms" ? <SmsGatewayCredentialsForm /> : <SendGridMarketingCredentialsForm />}
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
