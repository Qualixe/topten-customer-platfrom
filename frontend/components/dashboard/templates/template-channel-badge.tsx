import { Badge } from "@/components/ui/badge";
import type { TemplateChannel } from "@/lib/api/templates";

const CHANNEL_CONFIG: Record<TemplateChannel, { label: string; variant: "default" | "secondary" }> = {
  SMS: { label: "SMS", variant: "secondary" },
  EMAIL: { label: "Email", variant: "default" },
};

export function TemplateChannelBadge({ channel }: { channel: TemplateChannel }) {
  const config = CHANNEL_CONFIG[channel];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
