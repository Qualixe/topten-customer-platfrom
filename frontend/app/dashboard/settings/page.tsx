import { SettingsPageHeader } from "@/components/dashboard/settings/page-header";
import { SettingsTabs } from "@/components/dashboard/settings/settings-tabs";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <SettingsPageHeader />
      <SettingsTabs />
    </div>
  );
}
