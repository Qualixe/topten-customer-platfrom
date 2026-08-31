import { LiveClock } from "@/components/dashboard/settings/live-clock";

export function SettingsPageHeader() {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure platform preferences and defaults.
        </p>
      </div>
      <LiveClock />
    </div>
  );
}
